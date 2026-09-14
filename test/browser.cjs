/* Real browser checks against an isolated fixture preview. No database/SMS/payments. */
const {chromium,webkit}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve('public');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
 fs.readFile(file,(error,data)=>{
  if(error){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 fs.mkdirSync('test-results',{recursive:true});
 const browser=await chromium.launch();
 let cases=0;
 try{
  for(const [size,width,height] of [['desktop',1440,1000],['phone',390,844],['small-phone',320,740],['tablet',820,1180]]){
   const page=await browser.newPage({viewport:{width,height}});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('request',req=>assert.ok(!req.url().includes('/api/'),'Preview must never call real API'));
   await page.goto(base+'/design-preview.html');
   await page.waitForSelector('#si-phone');
   for(const screen of ['signin','home','request','details','location','review','garage','active','messages','chat','provider','jobs','team','admin','tech']){
    await page.evaluate(async screen=>{await previewPage(screen);},screen);
    await page.waitForTimeout(120);
    assert.ok(!(await page.locator('#root').innerText()).includes('Couldn’t load this page.'),size+' '+screen+' rendered an error');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
    assert.equal(overflow,false,size+' '+screen+' overflows horizontally');
    if(['signin','home','request','garage','active','chat','provider','admin'].includes(screen)&&['desktop','phone'].includes(size)){
     await page.screenshot({path:'test-results/'+size+'-'+screen+'.png',fullPage:true});
    }
    cases++;
   }
   // Mobile provider/admin navigation must stay usable with at most five destinations.
   await page.evaluate(()=>previewPage('provider'));await page.waitForTimeout(100);
   assert.equal(await page.locator('.tabbar button').count(),5);
   await page.evaluate(()=>previewPage('admin'));await page.waitForTimeout(100);
   assert.equal(await page.locator('.tabbar button').count(),5);
   await page.evaluate(()=>previewPage('tech'));await page.waitForTimeout(100);
   assert.equal(await page.locator('.tabbar button').count(),1);
   assert.equal(await page.locator('.sidebar').innerText().then(t=>t.includes('Live Leads')),false);
   // Changing language preserves a complete sign-in screen.
   await page.evaluate(async()=>{await previewPage('signin');setLang('es');await render();});
   assert.match(await page.locator('#root').innerText(),/Vuelva a la carretera/);
   // Rendering details after Back must honor the saved selection rather than the first rig.
   await page.evaluate(async()=>{
    setLang('en');await previewPage('details');
    S.trucks.push({id:99,data:{unit:'99',year:'2024',make:'Freightliner',model:'Cascadia'}});
    S.draft.truck_id=99;S.draft.trailer_id=null;await render();
   });
   assert.equal(await page.locator('#rq-truck .sel').getAttribute('data-id'),'99');
   assert.equal(await page.locator('#rq-trailer .sel').getAttribute('data-id'),'');
   // Equipment labels containing apostrophes are safe to edit.
   await page.evaluate(async()=>{
    await previewPage('garage');S.trucks[0].data.make="O'Brien";await render();
   });
   await page.locator('.equipment-actions button').first().click();
   await page.waitForSelector('#tk-make-other');
   assert.equal(await page.locator('#tk-make-other').inputValue(),"O'Brien");
   assert.deepEqual(errors,[],size+' browser errors');
   await page.close();
  }
  // Safari engine smoke on a phone layout, including keyboard-ready chat.
  const safari=await webkit.launch();
  try{
   const page=await safari.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   await page.goto(base+'/design-preview.html');await page.waitForSelector('#si-phone');
   for(const screen of ['home','request','garage','active','chat']){
    await page.evaluate(screen=>previewPage(screen),screen);await page.waitForTimeout(120);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'webkit '+screen+' overflow');
    cases++;
   }
   await page.locator('#chatIn').fill('Checking arrival time');
   assert.equal(await page.locator('#chatIn').inputValue(),'Checking arrival time');
   await page.screenshot({path:'test-results/iphone-webkit-chat.png',fullPage:true});
  }finally{await safari.close();}
  console.log('PASS: '+cases+' screen/viewport renders, role navigation, Spanish sign-in, saved equipment, apostrophe-safe editing, WebKit chat.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
