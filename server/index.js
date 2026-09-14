// ============ RIGRX server ============
require('dotenv').config();
const config=require('./config');
config.validate();
const http = require('http');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');
const { migrate, one } = require('./db');
const { attachUser } = require('./auth');
const { wsRegister } = require('./notify');
const routes = require('./routes');

const app = express();
app.disable('x-powered-by');
if(process.env.TRUST_PROXY)app.set('trust proxy',Number(process.env.TRUST_PROXY));
app.use(require('helmet')({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.post('/api/payments/webhook',express.raw({type:'application/json'}),require('./commerce').webhook);
app.use((req,res,next)=>{
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){
  const origin=req.headers.origin;
  const expected=process.env.BASE_URL?new URL(process.env.BASE_URL).origin:(req.protocol+'://'+req.get('host'));
  if((origin && origin!==expected)||req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Use the app on its configured address'});
 }
 next();
});
const {rateLimit}=require('express-rate-limit');
app.use('/api/auth',rateLimit({windowMs:15*60*1000,limit:60,standardHeaders:true,legacyHeaders:false,message:{error:'Too many sign-in attempts. Try later.'}}));
app.use('/api/upload',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(attachUser);

app.get('/api/config',(req,res)=>res.json({mode:config.mode,sms:config.smsMode,payments:config.paymentMode}));
app.get('/healthz',async(req,res)=>{try{await one('SELECT 1');res.json({ok:true});}catch(e){res.status(503).json({ok:false});}});
app.use('/api', routes);
app.get('/uploads/:filename',require('./files').download);
// index:false so the cache-busting handler below always renders index.html itself
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// ---- cache-busting ----
// index.html is never cached, and it stamps the current build number onto app.js /
// styles.css. When you deploy an update, browsers fetch the new files automatically
// instead of running stale code until someone thinks to hard-refresh.
const fs = require('fs');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
function buildStamp() {
  let newest = 0;
  for (const f of ['app.js', 'icons.js', 'guard.js', 'i18n.js', 'styles.css', 'design.css', 'ui.js', 'platform.js', 'workspace.js', 'index.html']) {
    try { newest = Math.max(newest, fs.statSync(path.join(PUBLIC_DIR, f)).mtimeMs); } catch (e) {}
  }
  return String(Math.round(newest));
}
let BUILD = buildStamp();
function sendIndex(req, res) {
  fs.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8', (err, html) => {
    if (err) return res.status(500).send('Could not load the app');
    res.set('Cache-Control', 'no-store');
    res.type('html').send(html.replace(/__BUILD__/g, BUILD));
  });
}
// Public recruiting page for service companies. A real static page rather than an
// app route, so it loads instantly and search engines can read it.
app.get(['/for-service-companies', '/service-companies', '/providers'], (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(PUBLIC_DIR, 'for-service-companies.html'));
});

app.get('*', sendIndex);

// central error handler. Errors that carry a status (like the sign-in rate
// limits) speak for themselves; anything else stays a generic 500.
app.use((err, req, res, next) => {
  if(err?.code==='LIMIT_FILE_SIZE')return res.status(413).json({error:'File must be smaller than 8 MB'});
  if(err?.name==='MulterError')return res.status(400).json({error:'Upload one file at a time'});
  if (err && err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end' });
});

// Last line of defence: log and keep serving rather than exiting the process.
process.on('unhandledRejection', e => console.error('Unhandled promise rejection:', e));
process.on('uncaughtException', e => console.error('Uncaught exception:', e));

const server = http.createServer(app);

// ---- WebSocket: authenticated by session cookie ----
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', async (socket, req) => {
  try {
    const expected=process.env.BASE_URL?new URL(process.env.BASE_URL).origin:null;
    if(req.headers.origin && expected && req.headers.origin!==expected)return socket.close();
    const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')));
    const token = cookies.rigrx_session;
    if (!token) return socket.close();
    const user = await one(
      `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at > NOW() AND u.archived_at IS NULL`, [token]);
    if (!user) return socket.close();
    wsRegister(user.id, socket, token);
    socket.alive=true;socket.on('pong',()=>{socket.alive=true;});
    socket.send(JSON.stringify({ event: 'hello', data: { user_id: user.id } }));
  } catch (e) { socket.close(); }
});

setInterval(async()=>{
 for(const socket of wss.clients){
  if(!socket.alive){socket.terminate();continue;}
  socket.alive=false;socket.ping();
  if(socket.sessionToken){
   try{if(!await one('SELECT token FROM sessions WHERE token=$1 AND expires_at>NOW()',[socket.sessionToken]))socket.close(4001,'Session expired');}catch(error){socket.close();}
  }
 }
},30000).unref();

setInterval(()=>require('./notify').deliverQueued().catch(e=>console.error('Notification queue unavailable')),5000).unref();

// Every minute: hand back unaccepted jobs, page the admin about silent requests,
// nudge stalled winners, and expire stale requests.
setInterval(() => {
  routes.sweepUnacceptedJobs?.().catch(e => console.error('job sweep failed:', e.message));
  routes.sweepMarketplace?.().catch(e => console.error('marketplace sweep failed:', e.message));
}, 60 * 1000).unref();

const PORT = process.env.PORT || 3000;
const { seedIfEmpty, seedTradesIfEmpty } = require('./catalog');
migrate().then(seedIfEmpty).then(seedTradesIfEmpty).then(()=>{if((config.mode==='demo'&&!process.env.DATABASE_URL)||process.env.SEED_DEMO==='true')return require('./demo').seedDemo();}).then(() => {
  server.listen(PORT, () => console.log(`RIGRX running on http://localhost:${PORT}`));
}).catch(e => {
  console.error('Database migration failed. Is DATABASE_URL set correctly?', e);
  process.exit(1);
});
