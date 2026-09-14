// ============ Database layer ============
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const {AsyncLocalStorage}=require('async_hooks');
const context=new AsyncLocalStorage();
let embedded,queue=Promise.resolve();
const local=!process.env.DATABASE_URL;
function exclusive(fn){const run=queue.then(fn,fn);queue=run.catch(()=>{});return run;}
if(local){
 if(require('./config').live)throw new Error('Live mode requires DATABASE_URL');
 const {PGlite}=require('@electric-sql/pglite');
 embedded=new PGlite(process.env.DEMO_DATABASE_DIR || path.join(__dirname,'../.demo-data'));
}
async function localQuery(sql,args=[]){
 if(sql.includes('pg_advisory_xact_lock'))return {rows:[]}; // embedded operations are already serialized
 if(!args.length && sql.includes(';')){const all=await embedded.exec(sql);return all[all.length-1]||{rows:[]};}
 return embedded.query(sql,args);
}
const pool=local?{
 query(sql,args=[]){return context.getStore()?localQuery(sql,args):exclusive(()=>localQuery(sql,args));},
 end(){return exclusive(()=>embedded.close());}
}:new Pool({connectionString:process.env.DATABASE_URL,
 ssl:process.env.DB_SSL==='disable'||/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL||'')?false:{rejectUnauthorized:process.env.DB_SSL!=='insecure'}});

async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows;
}
async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  // default pricing (insert-if-missing so admin edits survive restarts)
  const defaults = [
    ['towing',   'Heavy Towing & Recovery', 7500, 15000],
    ['tires',    'Tires',                   2500,  5000],
    ['wontstart',"Won't Start",             3500,  7000],
    ['mechanic', 'Mobile Mechanic',         3500,  7000],
    ['trailer',  'Trailer / Reefer',        4000,  8000],
    ['fuel',     'Fuel / DEF Delivery',     1500,  3000],
    ['lockout',  'Lockout',                 1500,  3000],
    ['other',    'Other Services',          2500,  5000]
  ];
  for (const [key, label, std, prem] of defaults) {
    await pool.query(
      `INSERT INTO pricing (service_key, label, standard_cents, premium_cents)
       VALUES ($1,$2,$3,$4) ON CONFLICT (service_key) DO NOTHING`, [key, label, std, prem]);
  }
}

async function transaction(fn) {
  if(local)return exclusive(()=>context.run(true,async()=>{
    await embedded.exec('BEGIN');
    const tx={q:async(sql,args=[]) => (await localQuery(sql,args)).rows};
    tx.one=async(sql,args=[]) => (await tx.q(sql,args))[0]||null;
    try{const result=await fn(tx);await embedded.exec('COMMIT');return result;}
    catch(error){await embedded.exec('ROLLBACK');throw error;}
  }));
  const client=await pool.connect();
  const tx={q:async(sql,args=[]) => (await client.query(sql,args)).rows};
  tx.one=async(sql,args=[]) => (await tx.q(sql,args))[0] || null;
  try { await client.query('BEGIN'); const result=await fn(tx); await client.query('COMMIT'); return result; }
  catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
module.exports = { pool, q, one, migrate, transaction };
