const mode = process.env.RIGRX_MODE || (process.env.NODE_ENV === 'production' ? 'live' : 'demo');
if (!['demo','test','live'].includes(mode)) throw new Error('RIGRX_MODE must be demo, test, or live');
const live = mode === 'live';
const smsMode = process.env.SMS_MODE || (live ? 'twilio' : 'simulated');
const paymentMode = process.env.PAYMENT_MODE || (live ? 'stripe' : 'simulated');
const storageMode = process.env.STORAGE_MODE || 'local';
function validate(){
 const missing=[];
 if(live&&!process.env.DATABASE_URL)missing.push('DATABASE_URL');
 if(!['twilio','simulated'].includes(smsMode))missing.push('valid SMS_MODE');
 if(!['stripe','simulated'].includes(paymentMode))missing.push('valid PAYMENT_MODE');
 if(!['local','s3'].includes(storageMode))missing.push('valid STORAGE_MODE');
 if(smsMode==='twilio')for(const k of ['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER'])if(!process.env[k])missing.push(k);
 if(paymentMode==='stripe')for(const k of ['STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','STRIPE_WEBHOOK_SECRET'])if(!process.env[k])missing.push(k);
 if(storageMode==='s3')for(const k of ['S3_BUCKET','S3_REGION','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY'])if(!process.env[k])missing.push(k);
 if(live){
  if(smsMode!=='twilio'||paymentMode!=='stripe')missing.push('real SMS and payment modes');
  if(!/^https:\/\//.test(process.env.BASE_URL||''))missing.push('HTTPS BASE_URL');
  if(!process.env.OTP_SECRET||process.env.OTP_SECRET.length<32)missing.push('OTP_SECRET (32+ characters)');
  if(storageMode==='local'&&!process.env.UPLOAD_DIR)missing.push('persistent UPLOAD_DIR or S3 storage');
 }
 if(missing.length)throw new Error('Configuration required: '+missing.join(', '));
}
module.exports={mode,live,smsMode,paymentMode,storageMode,validate};
