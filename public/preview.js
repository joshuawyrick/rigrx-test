/* Isolated design showroom. This file is loaded ONLY by design-preview.html.
   All service calls are local fixtures. It cannot send SMS, buy leads or change data. */
let previewRole='signed-out';
const previewTime=new Date().toISOString();
const previewTruck={id:12,data:{unit:'12',year:'2022',make:'Peterbilt',model:'389',engine:'Cummins X15',trans:'18-speed manual',axles:'Tandem',steer:'295/75R22.5',drive:'11R24.5',wheels:'Aluminum',color:'Red',duty:'heavy'}};
const previewTrailer={id:407,data:{num:'407',type:'Tanker — crude',len:'42 ft',axles:'Tandem',susp:'Air ride',tires:'11R24.5',hazmat:true,hzClass:'3',un:'1267'}};
const previewCatalog=[
 ['towing','Towing','truck','Heavy & medium duty, winch-out'],['tires','Tires','wheel','Replace or repair on the shoulder'],
 ['start',"Won't Start",'zap','Jump, batteries, starter'],['mechanical','Engine / Mechanical','wrench','Diagnostics, derate, air leaks'],
 ['trailer','Trailer / Reefer','trailer','Reefer down, brakes, lights'],['fuel','Fuel / DEF','fuel','Out of fuel, gelled, DEF'],
 ['lockout','Lockout','key','Keys locked in the cab'],['other','Other','box','Welding, glass, hydraulics…']
].map(([key,label,icon,blurb],i)=>({id:i+1,key,label,icon,blurb,driver_visible:true,items:[]}));
const previewRequest={id:12,service_key:'towing',service_label:'Heavy Towing & Recovery',status:'open',created_at:previewTime,buyer_count:2,notified_count:4,duty_class:'heavy',trade_filter:[],area_label:'Near Bakersfield, CA',selected_provider:null};
const previewResponders=[
 {provider_id:21,name:'Valley Recovery',rating:null,jobs_won:0,quote:{amount_cents:50000,eta:'35',note:'Heavy tow · confirm destination'}},
 {provider_id:22,name:'Kern Heavy Towing',rating:null,jobs_won:0,quote:{amount_cents:57500,eta:'50',note:'Heavy tow · confirm scope'}}
];
const previewThread={request_id:12,provider_id:21,other_name:'Valley Recovery',service_label:'Heavy Towing & Recovery',last_body:'We can help. Please confirm the destination.',status:'open'};
function previewMe(){
  const provider=['provider','dispatcher','tech'].includes(previewRole);
  return {user:previewRole==='signed-out'?null:{id:1,name:'Alex Morgan',phone:'+16615550198',lang:'en',
    role:provider?'provider':previewRole==='admin'?'admin':'driver',member_role:previewRole==='tech'?'tech':previewRole==='dispatcher'?'dispatcher':provider?'owner':null},
    provider:provider?{name:'Valley Recovery',approved:true,license_verified:true,locations:[],services:{},lead_credits:0,verification:{},capabilities:{}}:null,
    trucks:[previewTruck],trailers:[previewTrailer],simulatedPayments:true};
}
const previewLead={...previewRequest,truck_class:'2022 Peterbilt 389',trailer_type:'Crude tanker',hazmat:true,can_move:'no',band:'10–25 miles',slots:{total:1,standard:1,standardLeft:2},price_cents:3500,spec:[{k:'Engine',v:'Cummins X15'},{k:'Transmission',v:'18-speed manual'}]};
window.RIGRX_PLATFORM=Object.freeze({
  leadLink:window.RIGRX_PLATFORM.leadLink,
  liveConnection(){return {start(){},stop(){}};},
  async request(method,path,body){
    if(path==='/config')return {};
    if(path==='/auth/request-code')return {devCode:'123456'};
    if(path==='/auth/verify'){previewRole=body.role==='provider'?'provider':'driver';return {};}
    if(path==='/auth/logout'){previewRole='signed-out';return {};}
    if(path==='/me/lang')return {};
    if(method!=='GET')throw new Error('Design preview only — no changes are sent.');
    if(path==='/catalog')return previewCatalog;
    if(path==='/trades')return [];
    if(path==='/equipment')return {DUTY_CLASSES:[{key:'heavy',label:'Heavy duty',blurb:'Class 7–8'},{key:'medium',label:'Medium duty',blurb:'Class 4–6'},{key:'light',label:'Light duty',blurb:'Class 1–3'}],
      MAKES:{heavy:['Peterbilt','Freightliner']},MODELS:{Peterbilt:['389','579']},TRAILER_TYPES:['Tanker — crude','Dry van']};
    if(path==='/me')return previewMe();
    if(path==='/requests/mine')return [previewRequest,{...previewRequest,id:9,status:'completed',service_key:'tires',service_label:'Tires'},{...previewRequest,id:8,status:'cancelled'}];
    if(path.startsWith('/requests/preview'))return {matches:4,without_filters:4};
    if(path==='/requests/12')return {request:previewRequest,responders:previewResponders,on_the_way:null};
    if(path==='/messages/threads')return [previewThread,{...previewThread,provider_id:22,other_name:'Kern Heavy Towing',last_body:'Estimated arrival: 50 minutes.'}];
    if(path.startsWith('/messages/12/'))return {request:previewRequest,other_name:'Valley Recovery',others:{responders:2,quoted:2},messages:[
      {sender_id:21,body:'Hi Alex. We have a heavy wrecker available.',created_at:previewTime},
      {sender_id:1,body:'Thank you. What is the estimated arrival and price?',created_at:previewTime},
      {sender_id:21,body:'',quote:previewResponders[0].quote,created_at:previewTime}]};
    if(path==='/leads')return {approved:true,license_verified:true,leads:[previewLead,{...previewLead,id:13,service_key:'tires',service_label:'Commercial tires'}]};
    if(path==='/jobs')return {jobs:[],techs:[{id:3,name:'Taylor Lee'}]};
    if(path==='/tech/jobs')return [{id:12,service_label:'Heavy towing',area_label:'Near Bakersfield, CA',truck:previewTruck.data,accepted_at:null}];
    if(path==='/provider/members')return [{id:2,name:'Alex Morgan',phone:'+16615550198',member_role:'owner'},{id:3,name:'Taylor Lee',phone:'+16615550199',member_role:'tech'}];
    if(path==='/admin/overview')return {requests_24h:18,revenue_24h_cents:84000,revenue_total_cents:920000,fill_rate:82,drivers:124,providers:32,pending_providers:3,open_flags:2};
    if(path.startsWith('/geo?'))return {area_label:'Near Bakersfield, CA'};
    throw new Error('This tool is not included in the design showroom.');
  },
  async upload(){throw new Error('Uploads are disabled in the design preview.');},
  connect(){return {close(){}};},
  async locate(){return {coords:{latitude:35.3733,longitude:-119.0187}};}
});
async function previewPage(value){
  const map={signin:'signed-out',provider:'provider',jobs:'provider',team:'provider',admin:'admin',tech:'tech'};
  previewRole=map[value]||'driver';
  await loadMe();
  S.draft={service_key:'towing',service_label:'Towing',icon:'truck',truck_id:12,trailer_id:407,situation:['On highway shoulder'],can_move:'no',direction:'Northbound',lat:35.3733,lng:-119.0187,area_label:'Near Bakersfield, CA',landmark:'I-5 northbound shoulder',photos:[],description:'Engine stopped. Need a heavy tow.',trade_filter:[],duty_class:'heavy'};
  const views={signin:'signin',home:'d-home',request:'d-request',details:'d-details',location:'d-location',review:'d-review',garage:'d-garage',active:'d-active',messages:'d-threads',chat:'d-chat',provider:'p-feed',jobs:'p-jobs',team:'p-people',admin:'a-home',tech:'t-jobs'};
  S.activeRequestId=12;S.chatKey={r:12,p:21};
  nav(views[value]||'d-home');
}
