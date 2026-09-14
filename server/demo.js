require('dotenv').config();
const {q,one,transaction}=require('./db');
async function seedDemo(){
 if(require('./config').live)throw new Error('Demo seed is disabled in live mode');
 await transaction(async tx=>{
  const accounts=[['+16615550100','admin','Demo Administrator'],['+16615550198','driver','Demo Driver'],['+16615550101','provider','Valley Roadside Demo'],['+16615550102','provider','Demo Dispatcher'],['+16615550103','provider','Demo Technician'],['+16615550104','driver','Demo Fleet Office']];
  const users=[];
  for(const [phone,role,name] of accounts){
   let user=await tx.one('SELECT * FROM users WHERE phone=$1',[phone]);
   if(!user)user=await tx.one('INSERT INTO users(phone,role,name) VALUES($1,$2,$3) RETURNING *',[phone,role,name]);
   users.push(user);
  }
  const [admin,driver,provider,dispatcher,tech,office]=users;
  if(!await tx.one('SELECT * FROM providers WHERE user_id=$1',[provider.id])){
   const services={towing:['Heavy tow'],tires:['Replacement'],mechanic:['Diagnostics'],wontstart:['Jump start'],trailer:['Repair'],fuel:['Delivery'],lockout:['Unlock'],other:['Assistance']};
   await tx.q('INSERT INTO providers(user_id,name,approved,license_verified,services,lead_credits) VALUES($1,$2,TRUE,TRUE,$3,10)',[provider.id,'Valley Roadside Demo',JSON.stringify(services)]);
   await tx.q("INSERT INTO provider_locations(user_id,label,lat,lng,radius_mi) VALUES($1,'Bakersfield demo yard',35.3733,-119.0187,100)",[provider.id]);
   for(const [u,role] of [[provider,'owner'],[dispatcher,'dispatcher'],[tech,'tech']])await tx.q('UPDATE users SET company_id=$1,member_role=$2,assignable=$3 WHERE id=$4',[provider.id,role,role==='tech',u.id]);
  }
  let fleet=await tx.one('SELECT * FROM fleet_organizations WHERE owner_id=$1',[office.id]);
  if(!fleet){
   fleet=await tx.one("INSERT INTO fleet_organizations(name,owner_id) VALUES('Demo Transport Fleet',$1) RETURNING *",[office.id]);
   await tx.q("UPDATE users SET fleet_id=$1,fleet_role='owner' WHERE id=$2",[fleet.id,office.id]);
   await tx.q("UPDATE users SET fleet_id=$1,fleet_role='driver' WHERE id=$2 AND fleet_id IS NULL",[fleet.id,driver.id]);
   await tx.q('INSERT INTO trucks(user_id,fleet_id,assigned_driver,data) VALUES($1,$2,$3,$4)',[office.id,fleet.id,driver.id,JSON.stringify({unit:'12',year:'2022',make:'Peterbilt',model:'389',engine:'Cummins X15',trans:'18-speed manual',axles:'Tandem',steer:'295/75R22.5',drive:'11R24.5',color:'Red',duty:'heavy'})]);
   await tx.q('INSERT INTO trailers(user_id,fleet_id,assigned_driver,data) VALUES($1,$2,$3,$4)',[office.id,fleet.id,driver.id,JSON.stringify({num:'407',type:'Tanker',len:'42 ft',tires:'11R24.5',hazmat:false})]);
  }
 });
}
module.exports={seedDemo};
if(require.main===module){require('dotenv').config();require('./db').migrate().then(()=>require('./catalog').seedIfEmpty()).then(()=>require('./catalog').seedTradesIfEmpty()).then(seedDemo).then(()=>require('./db').pool.end()).catch(e=>{console.error(e);process.exit(1);});}
