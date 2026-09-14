const test=require('node:test');
const assert=require('node:assert/strict');
const {SELECT_PROVIDER}=require('../server/selection');
test('Selection requires an eligible purchase and preserves the first choice', {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const {Client}=require('pg');const db=new Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 try{
  await db.query(`CREATE TEMP TABLE users(id integer, archived_at timestamp);
    CREATE TEMP TABLE providers(user_id integer, approved boolean);
    CREATE TEMP TABLE purchases(request_id integer, provider_id integer, refunded boolean);
    CREATE TEMP TABLE requests(id integer, driver_id integer, status text, selected_provider integer, selected_at timestamp);
    INSERT INTO users VALUES(2,NULL),(3,NULL),(4,NOW());
    INSERT INTO providers VALUES(2,TRUE),(3,FALSE),(4,TRUE);
    INSERT INTO requests VALUES(12,1,'open',NULL,NULL);
    INSERT INTO purchases VALUES(12,3,FALSE),(12,4,FALSE);`);
  const choose=async(provider,driver=1)=>(await db.query(SELECT_PROVIDER,[provider,12,driver])).rows;
  assert.equal((await choose(2)).length,0,'no purchase');
  assert.equal((await choose(3)).length,0,'unapproved');
  assert.equal((await choose(4)).length,0,'archived');
  await db.query('INSERT INTO purchases VALUES(12,2,TRUE)');
  assert.equal((await choose(2)).length,0,'refunded');
  await db.query('UPDATE purchases SET refunded=FALSE WHERE provider_id=2');
  assert.equal((await choose(2,99)).length,0,'another driver');
  assert.equal((await choose(2))[0].selected_provider,2);
  assert.equal((await choose(2)).length,0,'already selected');
 }finally{await db.end();}
});
