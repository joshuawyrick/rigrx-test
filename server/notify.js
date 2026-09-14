// ============ Notifications: SMS (Twilio) + in-app websocket push ============
// With no Twilio keys set, SMS are SIMULATED: logged to console + notifications_log,
// so the whole app works before you buy a phone number.
const { q,transaction } = require('./db');

const config=require('./config');
const twilioClient=config.smsMode==='twilio'?require('twilio')(process.env.TWILIO_ACCOUNT_SID,process.env.TWILIO_AUTH_TOKEN):null;
async function sms(userId,phone,body,options={}){
  const simulated=config.smsMode==='simulated';
  if(!options.sensitive){await q('INSERT INTO notification_queue(user_id,phone,body) VALUES($1,$2,$3)',[userId,phone,body]);return true;}
  try{
    if(!simulated)await twilioClient.messages.create({to:phone,from:process.env.TWILIO_FROM_NUMBER,body});
    if(!options.sensitive)await q('INSERT INTO notifications_log(user_id,channel,body,simulated) VALUES($1,$2,$3,$4)',[userId,'sms',body,simulated]);
    return true;
  }catch(error){
    console.error('SMS delivery failed:',error.code || 'delivery-error');
    if(options.required)throw Object.assign(new Error('We could not send your code. Please try again shortly.'),{status:503});
    return false;
  }
}

// WebSocket registry: userId -> Set of sockets (set up in index.js)
const sockets = new Map();
function wsRegister(userId, socket, token) {
  socket.sessionToken=token;
  if (!sockets.has(userId)) sockets.set(userId, new Set());
  sockets.get(userId).add(socket);
  socket.on('close', () => {
    const set = sockets.get(userId);
    set?.delete(socket);
    if (set?.size === 0) sockets.delete(userId);
  });
}
function wsPush(userId, event, data) {
  const set = sockets.get(userId);
  if (!set) return;
  const payload = JSON.stringify({ event, data });
  for (const s of set) { if (s.readyState === 1) { try { s.send(payload); } catch (e) {} } }
}

function wsRevoke(userId,token){
  for(const [id,set] of sockets){
    if(userId && id!==userId)continue;
    for(const socket of set)if(!token || socket.sessionToken===token)socket.close(4001,'Session ended');
  }
}
async function wsCompany(companyId,event,data){
 const people=await q("SELECT id FROM users WHERE (id=$1 OR company_id=$1) AND archived_at IS NULL AND COALESCE(member_role,'owner') IN ('owner','dispatcher')",[companyId]);
 for(const person of people)wsPush(person.id,event,data);
}
async function deliverQueued(){
 for(let i=0;i<20;i++){
  const done=await transaction(async tx=>{
   const item=await tx.one("SELECT * FROM notification_queue WHERE status='pending' AND next_attempt<=NOW() ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED");
   if(!item)return false;
   try{
    if(config.smsMode==='twilio')await twilioClient.messages.create({to:item.phone,from:process.env.TWILIO_FROM_NUMBER,body:item.body});
    await tx.q("UPDATE notification_queue SET status='sent',attempts=attempts+1 WHERE id=$1",[item.id]);
    await tx.q('INSERT INTO notifications_log(user_id,channel,body,simulated) VALUES($1,$2,$3,$4)',[item.user_id,'sms',item.body,config.smsMode==='simulated']);
   }catch(error){await tx.q("UPDATE notification_queue SET attempts=attempts+1,status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'pending' END,next_attempt=NOW()+INTERVAL '2 minutes',last_error=$2 WHERE id=$1",[item.id,String(error.code||'delivery-failed')]);}
   return true;
  });if(!done)break;
 }
}
module.exports = { deliverQueued, sms, wsRegister, wsPush, wsRevoke, wsCompany };
