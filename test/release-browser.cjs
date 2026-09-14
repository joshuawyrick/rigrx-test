const {chromium}=require('playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
module.exports=async function check(base,accounts){
 const browser=await chromium.launch();fs.mkdirSync('test-results',{recursive:true});
 try{
  for(const width of [390,1440]){
   for(const [name,account,view] of [['fleet',accounts.fleet,'fleet'],['system',accounts.admin,'a-system'],['dispatcher',accounts.dispatch,'p-jobs'],['driver',accounts.driver,'d-home']]){
    const context=await browser.newContext({viewport:{width,height:900}});
    await context.addCookies([{name:'rigrx_session',value:account.cookie.split('=')[1],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.waitForSelector('.sidebar',{state:'attached'});
    await page.evaluate(async view=>{nav(view);await render();},view);
    const content=await page.locator('#root').innerText();assert.ok(!content.includes('Couldn’t load this page.'),name+' failed');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,name+' overflow at '+width);
    assert.deepEqual(errors,[],name+' JS errors');
    await page.screenshot({path:'test-results/live-'+name+'-'+width+'.png',fullPage:true});
    await context.close();
   }
  }
 }finally{await browser.close();}
};
