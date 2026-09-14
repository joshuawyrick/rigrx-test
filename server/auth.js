// ============ Phone-code (OTP) authentication + sessions ============
const crypto = require('crypto');
const { q, one, transaction } = require('./db');
const { sms, wsRevoke } = require('./notify');
const config=require('./config');

const DEV_MODE = config.smsMode === 'simulated';

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (String(raw).startsWith('+') && /^[1-9]\d{7,14}$/.test(digits)) return '+' + digits;
  return null;
}

function digest(phone,code){
  return crypto.createHmac('sha256',process.env.OTP_SECRET || 'local-demo-only-secret').update(phone+':'+code).digest('hex');
}
async function requestCode(phone){
  return transaction(async tx=>{
    await tx.q('SELECT pg_advisory_xact_lock(hashtext($1))',['otp:'+phone]);
    const recent=await tx.one("SELECT COUNT(*)::int AS n, MAX(created_at) AS last FROM otp_codes WHERE phone=$1 AND created_at>NOW()-INTERVAL '1 hour'",[phone]);
    if(recent.n>=5)throw Object.assign(new Error('Too many codes. Try again in an hour.'),{status:429});
    if(recent.last && Date.now()-new Date(recent.last).getTime()<30000)throw Object.assign(new Error('Wait 30 seconds before requesting another code.'),{status:429});
    const code=String(crypto.randomInt(100000,1000000));
    const known=await tx.one('SELECT lang FROM users WHERE phone=$1',[phone]);
    await sms(null,phone,known?.lang==='es'?`Su código RIGRX es ${code}. Vence en 10 minutos.`:`Your RIGRX code is ${code}. It expires in 10 minutes.`,{required:true,sensitive:true});
    await tx.q('UPDATE otp_codes SET used=TRUE WHERE phone=$1 AND used=FALSE',[phone]);
    await tx.q("INSERT INTO otp_codes(phone,code,expires_at) VALUES($1,$2,NOW()+INTERVAL '10 minutes')",[phone,digest(phone,code)]);
    return DEV_MODE?code:null;
  });
}
async function verifyCode(phone,code){
  if(!/^\d{6}$/.test(code))return null;
  return transaction(async tx=>{
    await tx.q('SELECT pg_advisory_xact_lock(hashtext($1))',['otp:'+phone]);
    const row=await tx.one('SELECT * FROM otp_codes WHERE phone=$1 AND used=FALSE AND expires_at>NOW() ORDER BY id DESC LIMIT 1 FOR UPDATE',[phone]);
    if(!row || row.attempts>=6)return null;
    const expected=Buffer.from(digest(phone,code));const actual=Buffer.from(row.code);
    const valid=expected.length===actual.length && crypto.timingSafeEqual(expected,actual);
    await tx.q('UPDATE otp_codes SET attempts=attempts+1,used=$1 WHERE id=$2',[valid || row.attempts>=5,row.id]);
    return valid || null;
  });
}

async function findOrCreateUser(phone, role) {
  let user = await one('SELECT * FROM users WHERE phone=$1', [phone]);
  if (!user) {
    const isAdmin = phone === normalizePhone(process.env.ADMIN_PHONE || '');
    user = await one(
      'INSERT INTO users (phone, role) VALUES ($1,$2) ON CONFLICT(phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING *',
      [phone, isAdmin ? 'admin' : (role === 'provider' ? 'provider' : 'driver')]);
    if (user.role === 'provider') {
      await q('INSERT INTO providers (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
      user=await one("UPDATE users SET company_id=id,member_role='owner' WHERE id=$1 RETURNING *",[user.id]);
    }
  }
  return user;
}

// Archiving takes effect immediately: every live session for that account is dropped,
// so someone already signed in is out on their next request rather than at expiry.
async function endAllSessions(userId) {
  await q('DELETE FROM sessions WHERE user_id=$1', [userId]);
  wsRevoke(userId);
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days
  await q('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)', [token, userId, expires]);
  return token;
}

// Express middleware: attaches req.user if a valid session cookie exists
async function attachUser(req, res, next) {
  try {
    const token = req.cookies?.rigrx_session;
    if (token) {
      req.user = await one(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token=$1 AND s.expires_at > NOW() AND u.archived_at IS NULL`, [token]);
    }
  } catch (e) { return next(e); }
  next();
}
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required' });
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Sign in required' });
    if (req.user.role !== role && req.user.role !== 'admin')
      return res.status(403).json({ error: `${role} account required` });
    next();
  };
}

module.exports = { normalizePhone, requestCode, verifyCode, findOrCreateUser, createSession, endAllSessions, attachUser, requireAuth, requireRole, DEV_MODE };
