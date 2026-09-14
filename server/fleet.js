const {q,one,transaction}=require('./db');
const auth=require('./auth');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const office=user=>!!user?.fleet_id && ['owner','dispatcher'].includes(user.fleet_role);
async function requestOwner(user,id){
 const r=await one('SELECT driver_id,fleet_id FROM requests WHERE id=$1',[id]);
 return r&&(r.driver_id===user.id || (office(user)&&r.fleet_id===user.fleet_id))?r.driver_id:null;
}
async function equipment(user,kind,id){
 if(!['trucks','trailers'].includes(kind))throw fail(400,'Invalid equipment');
 return one(`SELECT * FROM ${kind} WHERE id=$1 AND (user_id=$2 OR (fleet_id=$3 AND (assigned_driver=$2 OR $4::boolean)))`,[id,user.id,user.fleet_id,office(user)]);
}
function install(router){
 router.get('/fleet',auth.requireAuth,async(req,res)=>{
  const invitations=await q('SELECT i.id,i.role,f.name FROM fleet_invitations i JOIN fleet_organizations f ON f.id=i.fleet_id WHERE i.phone=$1',[req.user.phone]);
  if(!req.user.fleet_id)return res.json({invitations});
  const fleet=await one('SELECT * FROM fleet_organizations WHERE id=$1',[req.user.fleet_id]);
  if(!office(req.user))return res.json({fleet,invitations,members:[],trucks:[],trailers:[],requests:[]});
  const [members,trucks,trailers,requests,pending]=await Promise.all([
   q('SELECT id,name,phone,fleet_role FROM users WHERE fleet_id=$1 AND archived_at IS NULL ORDER BY name',[fleet.id]),
   q('SELECT * FROM trucks WHERE fleet_id=$1 ORDER BY id',[fleet.id]),q('SELECT * FROM trailers WHERE fleet_id=$1 ORDER BY id',[fleet.id]),
   q('SELECT r.*,u.name AS driver_name FROM requests r JOIN users u ON u.id=r.driver_id WHERE r.fleet_id=$1 ORDER BY r.id DESC LIMIT 100',[fleet.id]),
   q('SELECT id,phone,role FROM fleet_invitations WHERE fleet_id=$1',[fleet.id])]);
  res.json({fleet,invitations,members,trucks,trailers,requests,pending});
 });
 router.post('/fleet',auth.requireRole('driver'),async(req,res)=>{
  const name=String(req.body.name||'').trim().slice(0,100);if(!name)throw fail(400,'Enter your fleet name');
  const fleet=await transaction(async tx=>{
   const u=await tx.one('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.user.id]);
   if(u.fleet_id)throw fail(409,'You already belong to a fleet');
   const f=await tx.one('INSERT INTO fleet_organizations(name,owner_id) VALUES($1,$2) RETURNING *',[name,u.id]);
   await tx.q("UPDATE users SET fleet_id=$1,fleet_role='owner' WHERE id=$2",[f.id,u.id]);return f;
  });res.json(fleet);
 });
 router.post('/fleet/invitations',auth.requireAuth,async(req,res)=>{
  if(req.user.fleet_role!=='owner')throw fail(403,'Only the fleet owner can invite people');
  const phone=auth.normalizePhone(req.body.phone);if(!phone)throw fail(400,'Enter a valid phone');
  const role=req.body.role==='dispatcher'?'dispatcher':'driver';
  res.json(await one('INSERT INTO fleet_invitations(fleet_id,phone,role) VALUES($1,$2,$3) ON CONFLICT(fleet_id,phone) DO UPDATE SET role=$3 RETURNING *',[req.user.fleet_id,phone,role]));
 });
 router.post('/fleet/invitations/:id/accept',auth.requireRole('driver'),async(req,res)=>{
  await transaction(async tx=>{
   const u=await tx.one('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.user.id]);
   if(u.fleet_id)throw fail(409,'Leave your current fleet before accepting another');
   const i=await tx.one('SELECT * FROM fleet_invitations WHERE id=$1 AND phone=$2 FOR UPDATE',[req.params.id,u.phone]);
   if(!i)throw fail(404,'Invitation not found');
   await tx.q('UPDATE users SET fleet_id=$1,fleet_role=$2 WHERE id=$3',[i.fleet_id,i.role,u.id]);
   await tx.q('DELETE FROM fleet_invitations WHERE phone=$1',[u.phone]);
  });res.json({ok:true});
 });
 router.delete('/fleet/invitations/:id',auth.requireAuth,async(req,res)=>{
  if(req.user.fleet_role!=='owner')throw fail(403,'Owner access required');
  await q('DELETE FROM fleet_invitations WHERE id=$1 AND fleet_id=$2',[req.params.id,req.user.fleet_id]);res.json({ok:true});
 });
 router.delete('/fleet/members/:id',auth.requireAuth,async(req,res)=>{
  if(req.user.fleet_role!=='owner')throw fail(403,'Owner access required');
  if(Number(req.params.id)===req.user.id)throw fail(400,'The owner cannot remove themselves');
  await transaction(async tx=>{
   const u=await tx.one("UPDATE users SET fleet_id=NULL,fleet_role=NULL WHERE id=$1 AND fleet_id=$2 AND fleet_role<>'owner' RETURNING id",[req.params.id,req.user.fleet_id]);
   if(!u)throw fail(404,'Member not found');
   for(const kind of ['trucks','trailers'])await tx.q(`UPDATE ${kind} SET assigned_driver=NULL WHERE fleet_id=$1 AND assigned_driver=$2`,[req.user.fleet_id,u.id]);
  });res.json({ok:true});
 });
 router.put('/fleet/vehicles/:kind/:id/assignment',auth.requireAuth,async(req,res)=>{
  if(!office(req.user))throw fail(403,'Fleet office access required');
  const kind=req.params.kind;if(!['trucks','trailers'].includes(kind))throw fail(400,'Invalid equipment');
  const driver=req.body.driver_id?Number(req.body.driver_id):null;
  await transaction(async tx=>{
   if(driver&&!await tx.one("SELECT id FROM users WHERE id=$1 AND fleet_id=$2 AND fleet_role IN ('driver','owner') AND archived_at IS NULL FOR UPDATE",[driver,req.user.fleet_id]))throw fail(400,'Choose a driver in this fleet');
   const row=await tx.one(`UPDATE ${kind} SET assigned_driver=$1 WHERE id=$2 AND fleet_id=$3 RETURNING id`,[driver,req.params.id,req.user.fleet_id]);
   if(!row)throw fail(404,'Vehicle not found');
  });res.json({ok:true});
 });
}
module.exports={install,office,requestOwner,equipment};
