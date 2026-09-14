const test=require('node:test');const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rigrx-release-'));const base='http://127.0.0.1:3219';let server,logs='';
async function call(cookie,method,url,body){
 const response=await fetch(base+url,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function ok(cookie,method,url,body){const r=await call(cookie,method,url,body);assert.ok(r.status<300,method+' '+url+' '+JSON.stringify(r));return r.data;}
async function login(phone,role='driver'){
 const code=await ok(null,'POST','/api/auth/request-code',{phone});assert.match(code.devCode,/^\d{6}$/);
 const result=await call(null,'POST','/api/auth/verify',{phone,code:code.devCode,role});assert.equal(result.status,200,JSON.stringify(result));return {cookie:result.cookie,user:result.data.user,code:code.devCode,phone};
}
test.before(async()=>{
 server=spawn(process.execPath,['server/index.js'],{env:{...process.env,RIGRX_MODE:'demo',SMS_MODE:'simulated',PAYMENT_MODE:'simulated',STORAGE_MODE:'local',DATABASE_URL:process.env.RELEASE_DATABASE_URL||'',DEMO_DATABASE_DIR:path.join(dir,'db'),UPLOAD_DIR:path.join(dir,'uploads'),PORT:'3219',BASE_URL:base,SEED_DEMO:'true',DB_SSL:'disable'}});
 server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
 for(let i=0;i<150;i++){try{if((await fetch(base+'/healthz')).ok)return;}catch(e){}await new Promise(r=>setTimeout(r,200));}
 throw new Error('Server failed: '+logs);
});
test.after(async()=>{server?.kill();await new Promise(r=>server?.once('exit',r)||r());fs.rmSync(dir,{recursive:true,force:true});});
test('Full request, office, technician, fleet, files and concurrent billing flow',async()=>{
 const admin=await login('6615550100'),driver=await login('6615550198'),owner=await login('6615550101','provider'),dispatch=await login('6615550102','provider'),tech=await login('6615550103','provider'),fleet=await login('6615550104');
 assert.equal((await call(null,'POST','/api/auth/verify',{phone:driver.phone,code:driver.code})).status,400,'OTP cannot be reused');
 assert.equal((await call(driver.cookie,'GET','/api/admin/system')).status,403);
 assert.equal((await call(tech.cookie,'GET','/api/leads')).status,403);
 const me=await ok(driver.cookie,'GET','/api/me');assert.ok(me.trucks.length);assert.equal(me.trucks[0].assigned_driver,driver.user.id);
 assert.equal((await call(driver.cookie,'PUT','/api/trucks/'+me.trucks[0].id,{data:{make:'unauthorized edit'}})).status,403);
 const form=new FormData();form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1EAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'photo.png');
 const photo=await ok(driver.cookie,'POST','/api/upload',form);
 assert.equal((await fetch(base+photo.url)).status,401);
 assert.equal((await fetch(base+photo.url,{headers:{Cookie:owner.cookie}})).status,404);
 const payload={service_key:'towing',lat:35.3733,lng:-119.0187,truck_id:me.trucks[0].id,photos:[photo.url],description:'Demo breakdown',client_key:'same-request'};
 const [a,b]=await Promise.all([ok(driver.cookie,'POST','/api/requests',payload),ok(driver.cookie,'POST','/api/requests',payload)]);assert.equal(a.request.id,b.request.id);
 const id=a.request.id;
 assert.equal((await ok(fleet.cookie,'GET','/api/fleet')).requests[0].id,id);
 assert.equal((await call(owner.cookie,'POST','/api/requests',{...payload,client_key:'provider-attempt'})).status,403);
 assert.equal((await call(driver.cookie,'POST','/api/requests/'+id+'/select',{provider_id:owner.user.id})).status,409);
 const [p1,p2]=await Promise.all([ok(owner.cookie,'POST','/api/leads/'+id+'/buy'),ok(dispatch.cookie,'POST','/api/leads/'+id+'/buy')]);assert.equal(p1.id,p2.id);assert.equal(p1.paid_with,'credit');
 assert.equal((await ok(owner.cookie,'GET','/api/me')).provider.lead_credits,9);
 assert.equal((await fetch(base+photo.url,{headers:{Cookie:dispatch.cookie}})).status,200);
 assert.equal((await ok(dispatch.cookie,'GET','/api/messages/threads'))[0].request_id,id);
 const thread='/api/messages/'+id+'/'+owner.user.id;
 await ok(dispatch.cookie,'POST',thread,{body:'We can help',quote:{amount_cents:50000,eta:'35',note:'Heavy tow'}});
 assert.equal((await call(tech.cookie,'GET',thread)).status,403);
 await ok(fleet.cookie,'POST','/api/requests/'+id+'/select',{provider_id:owner.user.id});
 await ok(dispatch.cookie,'POST','/api/jobs/'+id+'/assign',{tech_id:tech.user.id});
 await ok(tech.cookie,'POST','/api/jobs/'+id+'/accept');
 await ok(tech.cookie,'POST','/api/jobs/'+id+'/enroute',{eta_minutes:35});
 assert.equal((await ok(driver.cookie,'GET','/api/requests/'+id)).on_the_way.eta_minutes,35);
 await ok(tech.cookie,'GET',thread);
 assert.equal((await call(tech.cookie,'POST',thread,{quote:{amount_cents:1}})).status,400);
 await ok(tech.cookie,'POST','/api/jobs/'+id+'/arrived');
 await ok(tech.cookie,'POST','/api/jobs/'+id+'/complete');
 await Promise.all([ok(admin.cookie,'POST','/api/admin/purchases/'+p1.id+'/refund'),ok(admin.cookie,'POST','/api/admin/purchases/'+p1.id+'/refund')]);
 assert.equal((await ok(owner.cookie,'GET','/api/me')).provider.lead_credits,10,'credit returned once');
 assert.equal((await fetch(base+photo.url,{headers:{Cookie:dispatch.cookie}})).status,404,'refund revokes photo access');
 const other=await login('6615550110');
 await ok(fleet.cookie,'POST','/api/fleet/invitations',{phone:other.phone,role:'driver'});
 const invite=(await ok(other.cookie,'GET','/api/fleet')).invitations[0];
 assert.equal((await call(driver.cookie,'POST','/api/fleet/invitations/'+invite.id+'/accept')).status,409);
 await ok(other.cookie,'POST','/api/fleet/invitations/'+invite.id+'/accept');
 await ok(fleet.cookie,'PUT','/api/fleet/vehicles/trucks/'+me.trucks[0].id+'/assignment',{driver_id:other.user.id});
 assert.equal((await ok(driver.cookie,'GET','/api/me')).trucks.length,0,'old assignment revoked');
 assert.equal((await ok(other.cookie,'GET','/api/me')).trucks.length,1);
 await ok(fleet.cookie,'DELETE','/api/fleet/members/'+other.user.id);
 assert.equal((await ok(other.cookie,'GET','/api/me')).trucks.length,0,'removed member cannot access fleet equipment');
 // Five distinct companies racing for one lead: only four can purchase.
 const lead=(await ok(driver.cookie,'POST','/api/requests',{service_key:'towing',lat:35.37,lng:-119.01,client_key:'race-slots'})).request;
 const companies=[];
 for(let i=20;i<25;i++){
  const c=await login('66155501'+i,'provider');companies.push(c);
  await ok(c.cookie,'PUT','/api/provider/profile',{name:'Demo shop '+i,services:{towing:['Heavy tow']},duty_classes:['heavy']});
  await ok(c.cookie,'POST','/api/provider/locations',{label:'Test',lat:35.37,lng:-119.01,radius_mi:100});
  await ok(admin.cookie,'POST','/api/admin/providers/'+c.user.id+'/approve');
 }
 const attempts=await Promise.all(companies.map(c=>call(c.cookie,'POST','/api/leads/'+lead.id+'/buy')));
 assert.equal(attempts.filter(r=>r.status===200).length,4,JSON.stringify(attempts));
 assert.equal(new Set(attempts.filter(r=>r.status===200).map(r=>r.data.slot)).size,4);
 if(process.env.RUN_BROWSER==='1')await require('./release-browser.cjs')(base,{admin,driver,dispatch,fleet});
 await ok(driver.cookie,'POST','/api/auth/logout');assert.equal((await ok(driver.cookie,'GET','/api/me')).user,null);
});
