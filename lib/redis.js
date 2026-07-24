/**
 * lib/redis.js
 * Thin wrapper around Upstash Redis REST API
 * ใช้ UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN จาก Vercel env
 */

const BASE = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!BASE || !TOKEN) {
  console.warn('[redis] UPSTASH_REDIS_REST_URL / TOKEN ยังไม่ได้ตั้งค่า — กรุณาเพิ่ม env var บน Vercel');
}

async function command(...args) {
  const res = await fetch(`${BASE}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

/* ─── Key schema ───────────────────────────────────────────
   order:{orderNo}          → JSON ของ order ทั้งหมด
   orders:list              → Redis List (LPUSH) ของ orderNo ทั้งหมด (ล่าสุดก่อน)
   orders:counter           → sequential counter for order ID generation
─────────────────────────────────────────────────────────── */

const KEY_ORDER   = (no) => `order:${no}`;
const KEY_LIST    = 'orders:list';
const KEY_COUNTER = 'orders:counter';
const KEY_USER    = (email) => `user:${String(email||'').toLowerCase().replace(/[^a-z0-9]+/g,'_')}:orders`;
const KEY_ADDR    = (email) => `user:${String(email||'').toLowerCase().replace(/[^a-z0-9]+/g,'_')}:address`;

/* คืนค่ารายการที่อยู่ทั้งหมดของผู้ใช้ (รองรับข้อมูลเก่าที่เก็บเป็น object เดี่ยว) */
export async function getUserAddresses(email) {
  const raw = await command('GET', KEY_ADDR(email));
  if (!raw) return [];
  const val = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (Array.isArray(val)) return val;
  return val && val.detail ? [val] : [];
}

/* (compat) คืนที่อยู่ล่าสุดเป็น object เดี่ยว */
export async function getUserAddress(email) {
  const list = await getUserAddresses(email);
  return list.length ? list[list.length - 1] : null;
}

/* เพิ่มที่อยู่ใหม่เข้า list (เก็บสูงสุด 20 รายการ) */
export async function addUserAddress(email, address) {
  const list = await getUserAddresses(email);
  list.push(address);
  const trimmed = list.slice(-20);
  await command('SET', KEY_ADDR(email), JSON.stringify(trimmed));
  return trimmed;
}

/* ลบที่อยู่ตาม index */
export async function deleteUserAddress(email, index) {
  const list = await getUserAddresses(email);
  if (index < 0 || index >= list.length) return list;
  list.splice(index, 1);
  await command('SET', KEY_ADDR(email), JSON.stringify(list));
  return list;
}

/* (compat) เขียนทับเป็นที่อยู่เดียว */
export async function saveUserAddress(email, address) {
  await command('SET', KEY_ADDR(email), JSON.stringify([address]));
  return address;
}

/* ─── รีวิว / แพ็กเกจจิ้ง ─── */
const KEY_REVIEWS = 'reviews:list';

export async function addReview(review) {
  await command('LPUSH', KEY_REVIEWS, JSON.stringify(review));
  await command('LTRIM', KEY_REVIEWS, 0, 199); // เก็บสูงสุด 200 รีวิว
  return review;
}

export async function listReviews(page = 0, size = 60) {
  const start = page * size;
  const end = start + size - 1;
  const raw = await command('LRANGE', KEY_REVIEWS, start, end);
  if (!raw || !raw.length) return [];
  return raw.map(r => { try { return typeof r === 'string' ? JSON.parse(r) : r; } catch { return null; } }).filter(Boolean);
}

export async function deleteReview(id) {
  const all = await command('LRANGE', KEY_REVIEWS, 0, -1);
  if (!all) return false;
  for (const r of all) {
    try { const o = typeof r === 'string' ? JSON.parse(r) : r; if (o && o.id === id) { await command('LREM', KEY_REVIEWS, 0, r); return true; } } catch {}
  }
  return false;
}

/* ─── เติมเงิน / เครดิต ─── */
const KEY_TOPUPS = 'topup:list';
const KEY_TOPUP  = (id) => `topup:${id}`;
const KEY_CREDIT = (email) => `user:${String(email||'').toLowerCase().replace(/[^a-z0-9]+/g,'_')}:credit`;

export async function addTopup(t) {
  await command('SET', KEY_TOPUP(t.id), JSON.stringify(t));
  await command('LPUSH', KEY_TOPUPS, t.id);
  await command('LTRIM', KEY_TOPUPS, 0, 499);
  return t;
}
export async function getTopup(id) {
  const raw = await command('GET', KEY_TOPUP(id));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
export async function updateTopup(id, patch) {
  const ex = await getTopup(id);
  if (!ex) return null;
  const up = { ...ex, ...patch, updatedAt: new Date().toISOString() };
  await command('SET', KEY_TOPUP(id), JSON.stringify(up));
  return up;
}
export async function deleteTopup(id) {
  const ex = await getTopup(id);
  await command('DEL', KEY_TOPUP(id));
  await command('LREM', KEY_TOPUPS, 0, id);
  return ex;
}
export async function listTopups(email) {
  const ids = await command('LRANGE', KEY_TOPUPS, 0, 499);
  if (!ids || !ids.length) return [];
  let list = await Promise.all(ids.map(getTopup));
  list = list.filter(Boolean);
  if (email) list = list.filter(t => (t.email||'').toLowerCase() === email.toLowerCase());
  return list;
}
/* กันสลิปซ้ำ — เก็บ hash ของสลิปที่เคยใช้ */
const KEY_SLIPS = 'topup:slips';
export async function slipSeen(hash) {
  const r = await command('SISMEMBER', KEY_SLIPS, hash);
  return Number(r) === 1;
}
export async function markSlip(hash) {
  await command('SADD', KEY_SLIPS, hash);
}
export async function unmarkSlip(hash) {
  await command('SREM', KEY_SLIPS, hash);
}

export async function getUserCredit(email) {
  const raw = await command('GET', KEY_CREDIT(email));
  const v = Number(raw) || 0;
  // ไม่โชว์ยอดติดลบให้ลูกค้า — ถ้าติดลบเก่าจากบั๊ก แสดงเป็น 0
  return v < 0 ? 0 : v;
}
/* คืนยอดจริงในฐาน (อาจติดลบ) — สำหรับ log/audit เท่านั้น อย่าใช้แสดงลูกค้า */
export async function getUserCreditRaw(email) {
  const raw = await command('GET', KEY_CREDIT(email));
  return Number(raw) || 0;
}
export async function addUserCredit(email, amount) {
  const r = await command('INCRBYFLOAT', KEY_CREDIT(email), Number(amount) || 0);
  return Number(r) || 0;
}
/* ตั้งค่าเครดิตเป็นค่าที่กำหนด (ใช้กับ reset/แก้ยอดติดลบ) */
export async function setUserCredit(email, amount) {
  await command('SET', KEY_CREDIT(email), String(Number(amount) || 0));
  return Number(amount) || 0;
}

export async function nextOrderNo() {
  const result = await command('INCR', KEY_COUNTER);
  const count = typeof result === 'string' ? Number(result) : result;
  const padded = String(count).padStart(6, '0');
  return `OP-${padded}`;
}

/* เลขออเดอร์ฝากจ่ายเงิน — prefix OVE แยกตัวนับจาก OP */
export async function nextPayNo() {
  const result = await command('INCR', 'orders:pay:counter');
  const count = typeof result === 'string' ? Number(result) : result;
  return `OVE-${String(count).padStart(6, '0')}`;
}

export async function saveOrder(order) {
  await command('SET', KEY_ORDER(order.orderNo), JSON.stringify(order));
  await command('LPUSH', KEY_LIST, order.orderNo);
  if (order.customer?.email) {
    await command('LPUSH', KEY_USER(order.customer.email), order.orderNo);
  }
  return order;
}

export async function getOrder(orderNo) {
  const raw = await command('GET', KEY_ORDER(orderNo));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function deleteOrder(orderNo) {
  const existing = await getOrder(orderNo);
  await command('DEL', KEY_ORDER(orderNo));
  await command('LREM', KEY_LIST, 0, orderNo);
  if (existing?.customer?.email) {
    await command('LREM', KEY_USER(existing.customer.email), 0, orderNo);
  }
  return !!existing;
}

export async function updateOrder(orderNo, patch) {
  const existing = await getOrder(orderNo);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await command('SET', KEY_ORDER(orderNo), JSON.stringify(updated));
  return updated;
}

/**
 * เพิ่ม checkpoint การขนส่ง (append เข้า tracking[]) และอัปเดตสถานะขนส่งปัจจุบัน
 * @param {string} orderNo
 * @param {object} event   - { step, location, note, at }
 * @param {string} [shipStatus] - สถานะขนส่งปัจจุบันใหม่ (ถ้ามี)
 */
export async function addTrackingEvent(orderNo, event, shipStatus) {
  const existing = await getOrder(orderNo);
  if (!existing) return null;
  const tracking = Array.isArray(existing.tracking) ? existing.tracking.slice() : [];
  tracking.push(event);
  const updated = {
    ...existing,
    tracking,
    ...(shipStatus ? { shipStatus } : {}),
    updatedAt: new Date().toISOString(),
  };
  await command('SET', KEY_ORDER(orderNo), JSON.stringify(updated));
  return updated;
}

/**
 * ดึง order หลาย ๆ ตัวตาม page
 * @param {number} page  - 0-indexed
 * @param {number} size  - จำนวนต่อหน้า (default 20)
 */
export async function listOrders(page = 0, size = 20) {
  const start = page * size;
  const end   = start + size - 1;
  const keys  = await command('LRANGE', KEY_LIST, start, end);
  if (!keys || !keys.length) return [];
  const orders = await Promise.all(keys.map(k => getOrder(k)));
  return orders.filter(Boolean);
}

export async function listOrdersByUser(email, page = 0, size = 20) {
  const start = page * size;
  const end   = start + size - 1;
  const keys  = await command('LRANGE', KEY_USER(email), start, end);
  if (!keys || !keys.length) return [];
  const orders = await Promise.all(keys.map(k => getOrder(k)));
  return orders.filter(Boolean);
}

export async function countOrders() {
  return command('LLEN', KEY_LIST);
}

/* ─── บัญชีผู้ใช้ — สมัคร/ล็อกอินด้วยเลขบัตรประชาชน หรือพาสปอร์ต ─── */
const KEY_ACCOUNT = (id) => `account:${String(id||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}`;

export async function getAccount(idNumber) {
  const raw = await command('GET', KEY_ACCOUNT(idNumber));
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}
export async function saveAccount(idNumber, account) {
  await command('SET', KEY_ACCOUNT(idNumber), JSON.stringify(account));
  await command('SADD', 'accounts:all', String(idNumber).toUpperCase().replace(/[^A-Z0-9]/g, ''));
  return account;
}

/* map อีเมล → เลขบัตร (สำหรับล็อกอินด้วยอีเมล) */
const KEY_EMAIL_ID = (email) => `account:email:${String(email||'').toLowerCase().replace(/[^a-z0-9]+/g,'_')}`;

export async function bindEmailToId(email, idNumber) {
  const e = String(email || '').toLowerCase().trim();
  if (!e) return;
  await command('SET', KEY_EMAIL_ID(e), String(idNumber));
  await command('SADD', 'accounts:emails', e);
}
export async function getIdByEmail(email) {
  const e = String(email || '').toLowerCase().trim();
  if (!e) return null;
  return await command('GET', KEY_EMAIL_ID(e));
}
export async function unbindEmail(email) {
  const e = String(email || '').toLowerCase().trim();
  if (!e) return;
  await command('DEL', KEY_EMAIL_ID(e));
  await command('SREM', 'accounts:emails', e);
}

/* ─── OTP (SMS) ─── */
/* เก็บโค้ด OTP แบบ TTL 5 นาที + rate limit 60 วิ per เบอร์ */
const KEY_OTP      = (phone) => `otp:${String(phone||'').replace(/\D/g,'')}`;
const KEY_OTP_RATE = (phone) => `otp:rate:${String(phone||'').replace(/\D/g,'')}`;

export async function saveOtp(phone, code, ttlSec = 300) {
  await command('SET', KEY_OTP(phone), String(code), 'EX', String(ttlSec));
}
export async function getOtp(phone) {
  const v = await command('GET', KEY_OTP(phone));
  return v || null;
}
export async function delOtp(phone) {
  await command('DEL', KEY_OTP(phone));
}

/* กันสแปม — คืน true ถ้ายังไม่พ้น cooldown */
export async function otpRateLimited(phone, cooldownSec = 60) {
  const v = await command('GET', KEY_OTP_RATE(phone));
  return !!v;
}
export async function markOtpSent(phone, cooldownSec = 60) {
  await command('SET', KEY_OTP_RATE(phone), '1', 'EX', String(cooldownSec));
}

/* รูปบัตรประชาชนของสมาชิก — เก็บแยก key เพื่อไม่ให้ listAccounts หนัก */
const KEY_ACCOUNT_IMG = (id) => `account:${String(id||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}:img`;

export async function getAccountImage(idOrEmail) {
  const raw = await command('GET', KEY_ACCOUNT_IMG(idOrEmail));
  return raw || null;
}
export async function saveAccountImage(idOrEmail, dataUrl) {
  await command('SET', KEY_ACCOUNT_IMG(idOrEmail), String(dataUrl));
}

/* รีเซ็ตสมาชิกทุกคน — ลบ account:<id>, account:<id>:img, ล้าง accounts:all,
   ลบ email map และ user:<email>:profile (ออเดอร์/ที่อยู่/เครดิตไม่แตะ) */
export async function resetAllVerifications() {
  const ids = await command('SMEMBERS', 'accounts:all');
  let deletedAccounts = 0;
  const emails = new Set();
  if (ids && ids.length) {
    for (const id of ids) {
      const acct = await getAccount(id);
      if (acct && acct.email) emails.add(String(acct.email).toLowerCase());
      await command('DEL', KEY_ACCOUNT(id));
      await command('DEL', KEY_ACCOUNT_IMG(id));
      deletedAccounts++;
    }
  }
  await command('DEL', 'accounts:all');
  // เก็บอีเมลเพิ่มจาก accounts:emails set (กรณี register แล้วยังไม่ได้ทำ e-KYC — ไม่มีเลขใน accounts:all)
  const regEmails = await command('SMEMBERS', 'accounts:emails');
  if (regEmails && regEmails.length) regEmails.forEach(e => emails.add(String(e).toLowerCase()));
  let deletedProfiles = 0;
  for (const e of emails) {
    await command('DEL', KEY_PROFILE(e));
    await command('DEL', KEY_EMAIL_ID(e));
    deletedProfiles++;
  }
  await command('DEL', 'accounts:emails');
  return { deletedAccounts, deletedProfiles };
}

/* รายชื่อสมาชิกทั้งหมด (สำหรับแอดมิน) — เรียงสมัครล่าสุดก่อน */
export async function listAccounts() {
  const ids = await command('SMEMBERS', 'accounts:all');
  if (!ids || !ids.length) return [];
  const list = await Promise.all(ids.map(getAccount));
  return list.filter(Boolean).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/* ─── โปรไฟล์ผู้ใช้ (เลขบัตรประชาชน / พาสปอร์ต สำหรับพิธีการนำเข้า) ─── */
const KEY_PROFILE = (email) => `user:${String(email||'').toLowerCase().replace(/[^a-z0-9]+/g,'_')}:profile`;

export async function getUserProfile(email) {
  const raw = await command('GET', KEY_PROFILE(email));
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}
export async function saveUserProfile(email, profile) {
  await command('SET', KEY_PROFILE(email), JSON.stringify(profile));
  return profile;
}

/* ─── รายชื่อผู้ใช้ที่เข้าระบบ (สำหรับนับจำนวนลูกค้า) ─── */
export async function addKnownUser(email) {
  const e = String(email || '').toLowerCase().trim();
  if (e) { try { await command('SADD', 'users:all', e); } catch (err) {} }
}
export async function countKnownUsers() {
  return Number(await command('SCARD', 'users:all')) || 0;
}

/* รีเซ็ตเครดิตของสมาชิกทุกคน — ลบ user:<email>:credit ทั้งหมด
   ใช้ผสม accounts:emails (จากการสมัคร) + users:all (คนที่เคยเข้าระบบ) เพื่อครอบคลุมทุกอีเมล
   ไม่แตะออเดอร์/ที่อยู่/สมาชิก */
export async function resetAllCredits() {
  const emails = new Set();
  try {
    const a = await command('SMEMBERS', 'accounts:emails');
    if (a && a.length) a.forEach(e => emails.add(String(e).toLowerCase()));
  } catch {}
  try {
    const b = await command('SMEMBERS', 'users:all');
    if (b && b.length) b.forEach(e => emails.add(String(e).toLowerCase()));
  } catch {}
  let deleted = 0;
  for (const e of emails) {
    const r = await command('DEL', KEY_CREDIT(e));
    if (Number(r) > 0) deleted++;
  }
  return { deletedCredits: deleted, checkedEmails: emails.size };
}

/* ─── ประวัติบิล (log การกระทำบนบิล) ─── */
/* ─── เรทแลกเงิน RMB → THB (แอดมินตั้งได้) ─── */
export async function getRmbRate() {
  try { const v = await command('GET', 'rate:rmb'); return Number(v) || 5.2; } catch (e) { return 5.2; }
}
export async function setRmbRate(v) {
  const n = Math.max(0.1, Math.min(100, Number(v) || 5.2));
  await command('SET', 'rate:rmb', String(n));
  return n;
}
/* เรทสำหรับ "ฝากจ่ายเงิน" (OVE) แยกจากเรทฝากสั่งสินค้า */
export async function getPayRate() {
  try { const v = await command('GET', 'rate:pay'); return Number(v) || (await getRmbRate()); } catch (e) { return 5.2; }
}
export async function setPayRate(v) {
  const n = Math.max(0.1, Math.min(100, Number(v) || 5.2));
  await command('SET', 'rate:pay', String(n));
  return n;
}

export async function addBillHistory(orderNo, entry) {
  const o = await getOrder(orderNo);
  if (!o) return;
  const hist = Array.isArray(o.history) ? o.history : [];
  hist.unshift({ at: new Date().toISOString(), action: String(entry.action || ''), note: String(entry.note || '') });
  await updateOrder(orderNo, { history: hist.slice(0, 100) });
}
