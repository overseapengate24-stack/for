/**
 * lib/tbs.js — ThaiBulkSMS API v2 wrapper
 * Uses HTTP Basic Auth: TBS_API_KEY:TBS_API_SECRET (from Vercel env)
 * Docs: https://developer.thaibulksms.com/
 */

const TBS_BASE = 'https://api-v2.thaibulksms.com';
const KEY    = () => (process.env.TBS_API_KEY    || '').trim();
const SECRET = () => (process.env.TBS_API_SECRET || '').trim();
const SENDER = () => (process.env.TBS_SENDER     || 'ThaiBulkSMS').trim();

function authHeader() {
  const raw = `${KEY()}:${SECRET()}`;
  return 'Basic ' + Buffer.from(raw, 'utf8').toString('base64');
}

/* แปลงเบอร์ไทยเป็น 66xxxxxxxxx ตามที่ TBS ต้องการ */
export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('66')) return digits;                 // 66812345678
  if (digits.startsWith('0'))  return '66' + digits.slice(1); // 0812345678 → 66812345678
  return digits;
}

/**
 * ส่ง SMS 1 เบอร์
 * @param {string} phone
 * @param {string} message
 * @param {object} [opts] - { sender, type: 'mkt'|'otp' }
 * @returns {Promise<object>} response ของ TBS
 */
export async function sendSMS(phone, message, opts = {}) {
  if (!KEY() || !SECRET()) throw new Error('TBS_API_KEY / TBS_API_SECRET ยังไม่ได้ตั้งค่า');
  const msisdn = normalizePhone(phone);
  if (!/^66\d{8,10}$/.test(msisdn)) throw new Error('รูปแบบเบอร์โทรไม่ถูกต้อง');
  const body = {
    msisdn,
    message: String(message).slice(0, 300),
    sender:  opts.sender || SENDER(),
    force:   'standard', // อย่าปลอมเป็น premium
    ...(opts.type ? { type: opts.type } : {}),
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res, text;
  try {
    res = await fetch(`${TBS_BASE}/sms`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    text = await res.text();
  } finally { clearTimeout(timer); }
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    const raw = (data && (data.detail || data.message || data.error));
    /* TBS อาจคืน error เป็น object เช่น { detail: [{loc:['body','msisdn'], msg:'...'}] }
       แปลงเป็นข้อความอ่านออกเสมอ */
    let msg;
    if (!raw) msg = `TBS HTTP ${res.status}`;
    else if (typeof raw === 'string') msg = raw;
    else if (Array.isArray(raw)) msg = raw.map(x => x?.msg || x?.message || JSON.stringify(x)).join(' · ');
    else msg = raw.msg || raw.message || JSON.stringify(raw);
    try { console.error('[tbs]', res.status, text.slice(0, 300)); } catch {}
    const err = new Error(msg); err.status = res.status; err.raw = text.slice(0, 500);
    throw err;
  }
  return data || {};
}

/* สร้างเลข OTP 6 หลัก (ยังเก็บไว้เผื่อ fallback) */
export function makeOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ─── TBS OTP Application API ──────────────────────────────────
   ใช้ endpoint แยกจาก /sms — subdomain otp.thaibulksms.com + path /v2/otp/*
   sender OTP_SMS ถูก approve ให้ตั้งแต่แรก ไม่ต้องขออนุมัติ
   ตั้งค่า OTP application ที่ portal → เอา App Key (TBS_OTP_KEY)
──────────────────────────────────────────────────────────────── */
const TBS_OTP_BASE = 'https://otp.thaibulksms.com/v2';
const OTP_KEY = () => (process.env.TBS_OTP_KEY || '').trim();

async function callTbsOtp(fullUrl, params, timeoutMs = 15000) {
  if (!KEY() || !SECRET()) throw new Error('TBS_API_KEY / TBS_API_SECRET ยังไม่ได้ตั้งค่า');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res, text;
  try {
    res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
      signal: ctrl.signal,
    });
    text = await res.text();
  } finally { clearTimeout(timer); }
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    const raw = data && (data.detail || data.message || data.error || data.description);
    let msg;
    if (!raw) msg = text ? `TBS HTTP ${res.status}: ${text.slice(0, 200)}` : `TBS HTTP ${res.status}`;
    else if (typeof raw === 'string') msg = raw;
    else if (Array.isArray(raw)) msg = raw.map(x => x?.msg || x?.message || JSON.stringify(x)).join(' · ');
    else msg = raw.msg || raw.message || JSON.stringify(raw);
    try { console.error('[tbs-otp]', fullUrl, res.status, text.slice(0, 500)); } catch {}
    const err = new Error(msg); err.status = res.status; err.raw = text.slice(0, 500);
    throw err;
  }
  return data || {};
}

/**
 * ขอ OTP ใหม่ — TBS สร้างรหัส + ส่ง SMS + คืน token กลับมา
 * @param {string} phone  0812345678 หรือ 66812345678
 * @returns {Promise<{token, ref}>}
 */
export async function requestOtp(phone) {
  const key = OTP_KEY();
  if (!key) throw new Error('TBS_OTP_KEY ยังไม่ได้ตั้งค่า');
  const msisdn = normalizePhone(phone);
  if (!/^66\d{8,10}$/.test(msisdn)) throw new Error('รูปแบบเบอร์โทรไม่ถูกต้อง');
  const r = await callTbsOtp(`${TBS_OTP_BASE}/otp/request`, { key, msisdn });
  return {
    token: r.token || r.otp_token || r.data?.token || '',
    ref: r.ref || r.reference || r.data?.ref || '',
    raw: r,
  };
}

/**
 * ตรวจสอบ OTP กับ TBS
 * @param {string} token  token ที่ได้ตอน requestOtp
 * @param {string} pin    รหัส 6 หลักที่ลูกค้ากรอก
 * @returns {Promise<{valid, raw}>}
 */
export async function verifyOtp(token, pin) {
  if (!token) return { valid: false, raw: { error: 'missing token' } };
  const r = await callTbsOtp(`${TBS_OTP_BASE}/otp/verify`, { token, pin: String(pin) });
  // TBS ตอบ status/success/valid ต่างกันตามเวอร์ชัน — ยอมรับได้หลายชื่อ
  const valid = r.status === 'success' || r.status === 'ok' || r.valid === true || r.success === true;
  return { valid, raw: r };
}
