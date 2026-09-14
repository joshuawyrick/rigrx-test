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
