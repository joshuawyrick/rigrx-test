const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('public/platform.js','utf8');
function client(fetch){
 const sandbox={fetch,FormData:class{append(){}},location:{protocol:'https:',host:'test.example'},WebSocket:class{constructor(url){this.url=url;}},
 navigator:{geolocation:{getCurrentPosition(resolve){resolve({coords:{latitude:35,longitude:-119}});}}}};
 vm.createContext(sandbox);vm.runInContext(source,sandbox);return sandbox.RIGRX_PLATFORM;
}
test('API requests keep same-origin session authentication and pass structured payloads',async()=>{
 let call;
 const p=client(async(url,options)=>{call={url,options};return {ok:true,json:async()=>({id:12})};});
 assert.equal((await p.request('POST','/requests',{description:'Needs a tow'})).id,12);
 assert.equal(call.url,'/api/requests');assert.equal(call.options.credentials,'same-origin');
 assert.deepEqual(JSON.parse(call.options.body),{description:'Needs a tow'});
});
test('Rejected uploads surface the server error instead of silently continuing',async()=>{
 const p=client(async()=>({ok:false,status:413,json:async()=>({error:'File too large'})}));
 await assert.rejects(p.upload({}),error=>error.status===413&&error.message==='File too large');
});
test('Live connection stays on the authenticated host and uses TLS',()=>{
 assert.equal(client().connect().url,'wss://test.example/ws');
});
test('Location adapter returns the browser coordinates',async()=>{
 const pos=await client().locate();assert.equal(pos.coords.latitude,35);
});
test('All shipped JavaScript parses',()=>{
 for(const dir of ['public','server']){
  for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.js'))){
   new vm.Script(fs.readFileSync(dir+'/'+file,'utf8'),{filename:dir+'/'+file});
  }
 }
});
test('Web worker does not cache private app responses',()=>{
 const sw=fs.readFileSync('public/sw.js','utf8');
 assert.match(sw,/cache\.addAll\(\['\/offline.html','\/app-icon.svg'\]\)/);
 assert.doesNotMatch(sw,/\.put\(/);
 assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
});
test('SMS lead links allow only valid provider destinations',()=>{
 const p=client();const owner={role:'provider'};
 assert.equal(p.leadLink('#lead-12',owner).leadId,12);
 for(const hash of ['#lead-0','#lead--1','#lead-12/other','#lead-9007199254740992','#main-content'])assert.equal(p.leadLink(hash,owner),null);
 for(const user of [null,{role:'driver'},{role:'admin'},{role:'provider',member_role:'tech'}])assert.equal(p.leadLink('#lead-12',user),null);
});
test('Live updates use one connection and one retry; logout cancels stale callbacks',()=>{
 const sockets=[],timers=new Map();let id=0,delivered=0;
 const sandbox={location:{protocol:'https:',host:'test.example'},WebSocket:class{
  constructor(){sockets.push(this);} close(){this.onclose?.();}
 }};
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
 const clock={setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 const live=sandbox.RIGRX_PLATFORM.liveConnection(()=>delivered++,clock);
 live.start();live.start();assert.equal(sockets.length,1);
 sockets[0].onclose();sockets[0].onclose();assert.equal(timers.size,1);
 const retry=[...timers.values()][0];timers.clear();retry();assert.equal(sockets.length,2);
 sockets[0].onclose();assert.equal(timers.size,0);
 sockets[0].onmessage({});sockets[1].onmessage({});assert.equal(delivered,1);
 live.stop();assert.equal(timers.size,0);sockets[1].onclose();assert.equal(timers.size,0);
 live.start();sockets[2].onclose();assert.equal(timers.size,1);
 const stale=[...timers.values()][0];live.stop();stale();assert.equal(sockets.length,3);
});
