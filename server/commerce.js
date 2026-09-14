const crypto=require('crypto');
const {q,one,transaction}=require('./db');
const payments=require('./payments');
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function eligible(provider,request,tx={q,one}){
 if(!provider?.approved)return false;
 let matches=await require('./match').matchProviders(request);
 if(!matches.length)matches=await require('./match').matchProviders(request,50);
 return matches.some(m=>m.user_id===provider.user_id);
}
async function finalize(orderId,paymentId){
 return transaction(async tx=>{
  const info=await tx.one('SELECT request_id FROM payment_orders WHERE id=$1',[orderId]);
  if(!info)throw fail(404,'Payment order not found');
  await tx.q('SELECT id FROM requests WHERE id=$1 FOR UPDATE',[info.request_id]);
  const order=await tx.one('SELECT * FROM payment_orders WHERE id=$1 FOR UPDATE',[orderId]);
  const old=await tx.one('SELECT * FROM purchases WHERE request_id=$1 AND provider_id=$2',[order.request_id,order.provider_id]);
  if(old)return old;
  if(order.status!=='pending')throw fail(409,'Payment requires administrator review');
  const purchase=await tx.one(`INSERT INTO purchases(request_id,provider_id,slot,amount_cents,premium,stripe_payment,paid_with,list_price_cents)
    VALUES($1,$2,$3,$4,$5,$6,'card',$4) RETURNING *`,[order.request_id,order.provider_id,order.slot,order.amount_cents,order.premium,paymentId]);
  await tx.q("UPDATE payment_orders SET status='paid',payment_id=$2,error=NULL WHERE id=$1",[order.id,paymentId]);
  return purchase;
 });
}
async function buy(requestId,providerId){
 const reserved=await transaction(async tx=>{
  const r=await tx.one(`SELECT r.*,p.standard_cents,p.premium_cents FROM requests r JOIN pricing p ON p.service_key=r.service_key WHERE r.id=$1 FOR UPDATE OF r`,[requestId]);
  if(!r)throw fail(404,'Lead not found');
  const existing=await tx.one('SELECT * FROM purchases WHERE request_id=$1 AND provider_id=$2',[requestId,providerId]);
  if(existing){if(existing.refunded)throw fail(409,'This lead was refunded');return {purchase:existing};}
  const p=await tx.one('SELECT * FROM providers WHERE user_id=$1 FOR UPDATE',[providerId]);
  const pending=await tx.one('SELECT * FROM payment_orders WHERE request_id=$1 AND provider_id=$2',[requestId,providerId]);
  if(pending?.status==='pending'){
   if(Date.now()-new Date(pending.created_at)>23*3600000)throw fail(409,'Payment awaiting reconciliation. Contact RIGRX; do not pay again.');
   return {order:pending,provider:p};
  }
  if(r.status!=='open')throw fail(409,'Lead is no longer open');
  if(!await eligible(p,r,tx))throw fail(403,'This lead does not match your approved services or coverage');
  const used=await tx.q(`SELECT slot FROM purchases WHERE request_id=$1 AND refunded=FALSE
     UNION SELECT slot FROM payment_orders WHERE request_id=$1 AND status='pending'`,[requestId]);
  const slot=[1,2,3,4].find(n=>!used.some(s=>s.slot===n));
  if(!slot)throw fail(409,'All response slots are taken');
  const premium=slot===4,amount=premium?r.premium_cents:r.standard_cents;
  if(p.lead_credits>0){
   await tx.q('UPDATE providers SET lead_credits=lead_credits-1 WHERE user_id=$1',[providerId]);
   await tx.q('INSERT INTO credit_log(provider_id,delta,reason) VALUES($1,-1,$2)',[providerId,'Lead #'+requestId]);
   const purchase=await tx.one(`INSERT INTO purchases(request_id,provider_id,slot,amount_cents,premium,stripe_payment,paid_with,list_price_cents)
    VALUES($1,$2,$3,0,$4,'credit','credit',$5) RETURNING *`,[requestId,providerId,slot,premium,amount]);
   return {purchase};
  }
  if(pending)await tx.q('DELETE FROM payment_orders WHERE id=$1 AND status=$2',[pending.id,'failed']);
  const order=await tx.one('INSERT INTO payment_orders(id,request_id,provider_id,slot,premium,amount_cents) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[crypto.randomUUID(),requestId,providerId,slot,premium,amount]);
  return {order,provider:p};
 });
 if(reserved.purchase)return reserved.purchase;
 const {order,provider}=reserved;
 const charge=await payments.chargeLead(provider,order.amount_cents,'RIGRX lead #'+order.request_id,order.id);
 if(!charge.ok){
  if(!charge.uncertain)await q("UPDATE payment_orders SET status='failed',error=$2 WHERE id=$1 AND status='pending'",[order.id,charge.error]);
  throw fail(charge.uncertain?503:402,charge.uncertain?'Payment is pending confirmation. Retry this same lead shortly.':'Payment declined. Update your saved card.');
 }
 return finalize(order.id,charge.paymentId);
}
async function refundPurchase(id){
 return transaction(async tx=>{
  const info=await tx.one('SELECT request_id FROM purchases WHERE id=$1',[id]);
  if(!info)throw fail(404,'Purchase not found');
  const request=await tx.one('SELECT * FROM requests WHERE id=$1 FOR UPDATE',[info.request_id]);
  const pu=await tx.one('SELECT * FROM purchases WHERE id=$1 FOR UPDATE',[id]);
  if(pu.refunded)return {ok:true};
  if(request.selected_provider===pu.provider_id && request.status==='selected')throw fail(409,'Cancel or complete the active job before refunding its lead');
  if(pu.paid_with==='credit'){
   await tx.q('UPDATE providers SET lead_credits=lead_credits+1 WHERE user_id=$1',[pu.provider_id]);
   await tx.q('INSERT INTO credit_log(provider_id,delta,reason,by_admin) VALUES($1,1,$2,TRUE)',[pu.provider_id,'Refund lead #'+pu.request_id]);
  }else{
   const result=await payments.refund(pu.stripe_payment,pu.id);
   if(!result.ok)throw fail(502,'Refund pending or failed. Retry this refund; it uses the same payment reference.');
  }
  await tx.q('UPDATE purchases SET refunded=TRUE WHERE id=$1',[id]);
  return {ok:true};
 });
}
async function webhook(req,res,next){
 try{
  if(!payments.stripe)return res.sendStatus(404);
  let event;try{event=payments.stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);}catch(error){return res.status(400).send('Invalid signature');}
  if(await one('SELECT id FROM stripe_events WHERE id=$1',[event.id]))return res.json({received:true});
  const intent=event.data.object;
  if(event.type==='payment_intent.succeeded'&&intent.metadata?.rigrx_order){
   const order=await one('SELECT * FROM payment_orders WHERE id=$1',[intent.metadata.rigrx_order]);
   if(order && order.amount_cents===intent.amount && intent.currency==='usd')await finalize(order.id,intent.id);
  }
  await q('INSERT INTO stripe_events(id) VALUES($1) ON CONFLICT DO NOTHING',[event.id]);
  res.json({received:true});
 }catch(error){next(error);}
}
module.exports={buy,finalize,refundPurchase,webhook,eligible};
