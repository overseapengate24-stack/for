/**
 * api/address.js
 * GET  /api/address?email=...             → ดึงที่อยู่จัดส่งของผู้ใช้
 * POST /api/address                       → บันทึก/อัปเดตที่อยู่จัดส่ง
 * POST /api/address body:{ register|login|otpSend|otpVerify|... }  → auth
 * GET  /api/address?members=1             → (แอดมิน) รายชื่อสมาชิก
 */

import { getUserAddresses, addUserAddress, deleteUserAddress, saveUserProfile, getAccount, saveAccount, addKnownUser, listAccounts, resetAllVerifications, bindEmailToId, getIdByEmail, saveOtp, getOtp, delOtp, otpRateLimited, markOtpSent } from '../lib/redis.js';
import { sendSMS, normalizePhone, makeOtp } from '../lib/tbs.js';
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

/* Password hashing — Node built-in scrypt (ไม่ต้องพึ่ง lib ภายนอก) */
function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(pw), salt, 64).toString('hex');
  return `s2:${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  try {
    const [ver, salt, hash] = String(stored || '').split(':');
    if (ver !== 's2' || !salt || !hash) return false;
    const test = scryptSync(String(pw), salt, 64);
    const known = Buffer.from(hash, 'hex');
    return known.length === test.length && timingSafeEqual(known, test);
  } catch { return false; }
}
/* ตัดฟิลด์ passwordHash ออกก่อนส่งกลับ client */
function safeAccount(a) {
  if (!a) return null;
  const { passwordHash, ...rest } = a;
  return rest;
}

const ADMIN_KEY_ENV = () => (process.env.ADMIN_SECRET_KEY || 'changeme').trim();
const isAdminReq = (req) => String(req.headers['x-admin-key'] || '').trim() === ADMIN_KEY_ENV();

/* เลขบัตรประชาชนไทย 13 หลัก — ตรวจ checksum ตามสูตร mod 11 */
function validThaiId(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}
function clean(a) {
  const s = (v, n) => String(v || '').slice(0, n);
  return {
    recipient:   s(a?.recipient, 120),
    phone:       s(a?.phone, 40),
    houseNo:     s(a?.houseNo, 60),
    moo:         s(a?.moo, 30),
    building:    s(a?.building, 120),
    soi:         s(a?.soi, 80),
    road:        s(a?.road, 80),
    subdistrict: s(a?.subdistrict, 80),
    district:    s(a?.district, 80),
    province:    s(a?.province, 80),
    postal:      s(a?.postal, 10),
    detail:      s(a?.detail, 600),
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    /* รายชื่อสมาชิกทั้งหมด (เฉพาะแอดมิน) */
    if (req.query.members) {
      if (!isAdminReq(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
      const accts = await listAccounts();
      const members = accts.map(a => ({
        name: a.name || '',
        email: String(a.email || '').toLowerCase(),
        phone: a.phone || '',
        idNumber: a.idNumber || '',
        idType: a.idType || 'thai',
        createdAt: a.createdAt || '',
      })).sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || '')));
      return res.status(200).json({ ok: true, members });
    }

    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'ระบุ email' });

    const addresses = await getUserAddresses(email);
    return res.status(200).json({
      ok: true,
      addresses,
      address: addresses.length ? addresses[addresses.length - 1] : null, // compat
    });
  }

  if (req.method === 'POST') {
    const { email, address } = req.body || {};

    /* ── OTP: ขอส่ง SMS ── */
    if (req.body && req.body.otpSend) {
      const phone = normalizePhone(req.body.otpSend.phone);
      if (!/^66\d{8,10}$/.test(phone)) return res.status(400).json({ ok: false, error: 'รูปแบบเบอร์โทรไม่ถูกต้อง' });
      if (await otpRateLimited(phone)) return res.status(429).json({ ok: false, error: 'ขอ OTP บ่อยเกินไป — กรุณารอ 60 วินาที' });
      const code = makeOtp();
      try {
        await sendSMS(phone, `รหัสยืนยัน Oversea PenGate: ${code} (หมดอายุใน 5 นาที)`, { type: 'otp' });
      } catch (err) {
        return res.status(502).json({ ok: false, error: err.message || 'ส่ง SMS ไม่สำเร็จ' });
      }
      await saveOtp(phone, code, 300);
      await markOtpSent(phone, 60);
      return res.status(200).json({ ok: true, expiresIn: 300 });
    }

    /* ── OTP: ยืนยันรหัส ── */
    if (req.body && req.body.otpVerify) {
      const phone = normalizePhone(req.body.otpVerify.phone);
      const code = String(req.body.otpVerify.code || '').trim();
      if (!/^\d{6}$/.test(code)) return res.status(400).json({ ok: false, error: 'รหัส OTP ต้องเป็นตัวเลข 6 หลัก' });
      const stored = await getOtp(phone);
      if (!stored) return res.status(410).json({ ok: false, error: 'รหัสหมดอายุ กรุณาขอใหม่' });
      if (stored !== code) return res.status(401).json({ ok: false, error: 'รหัส OTP ไม่ถูกต้อง' });
      return res.status(200).json({ ok: true });
    }

    /* ── สมัครสมาชิกใหม่ ── */
    if (req.body && req.body.register) {
      const r = req.body.register;
      const name = String(r.name || '').trim().slice(0, 120);
      const phone = String(r.phone || '').trim().replace(/[^\d+-]/g, '').slice(0, 20);
      const email = String(r.email || '').trim().toLowerCase().slice(0, 120);
      const password = String(r.password || '');
      const confirmPassword = String(r.confirmPassword || '');
      const idNumber = String(r.idNumber || '').trim();
      const otpCode = String(r.otpCode || '').trim();
      if (!name) return res.status(400).json({ ok: false, error: 'กรุณากรอกชื่อ-นามสกุล' });
      if (!phone || phone.replace(/\D/g, '').length < 9) return res.status(400).json({ ok: false, error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ ok: false, error: 'รูปแบบอีเมลไม่ถูกต้อง' });
      if (password.length < 6) return res.status(400).json({ ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
      if (password !== confirmPassword) return res.status(400).json({ ok: false, error: 'รหัสผ่านไม่ตรงกัน' });
      if (!validThaiId(idNumber)) return res.status(400).json({ ok: false, error: 'เลขบัตรประชาชนไม่ถูกต้อง' });
      // ต้องยืนยัน OTP เบอร์นี้ก่อน
      const phoneKey = normalizePhone(phone);
      const storedOtp = await getOtp(phoneKey);
      if (!storedOtp || !otpCode || storedOtp !== otpCode) {
        return res.status(401).json({ ok: false, error: 'ยืนยัน OTP ไม่ผ่าน — กรุณาขอ OTP แล้วกรอกรหัส' });
      }
      // เช็คซ้ำ
      const existingByEmail = await getIdByEmail(email);
      if (existingByEmail) return res.status(409).json({ ok: false, error: 'อีเมลนี้ถูกใช้สมัครแล้ว — กรุณาเข้าสู่ระบบ' });
      const existingById = await getAccount(idNumber);
      if (existingById) return res.status(409).json({ ok: false, error: 'เลขบัตรประชาชนนี้ถูกใช้สมัครแล้ว' });
      const now = new Date().toISOString();
      const acct = {
        name, phone, email, idNumber,
        idType: 'thai',
        passwordHash: hashPassword(password),
        verifyStatus: 'NONE',
        createdAt: now,
      };
      await saveAccount(idNumber, acct);
      await bindEmailToId(email, idNumber);
      await saveUserProfile(email, { idType: 'thai', idNumber, registeredAt: now });
      try { await addKnownUser(email); } catch (e2) {}
      try { await delOtp(phoneKey); } catch (e2) {}   // ใช้ OTP แล้ว ทิ้ง
      return res.status(200).json({ ok: true, user: safeAccount(acct) });
    }

    /* ── เข้าสู่ระบบด้วยอีเมล + รหัสผ่าน ── */
    if (req.body && req.body.login) {
      const email = String(req.body.login.email || '').trim().toLowerCase();
      const password = String(req.body.login.password || '');
      if (!email || !password) return res.status(400).json({ ok: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
      const idNumber = await getIdByEmail(email);
      if (!idNumber) return res.status(401).json({ ok: false, error: 'ไม่พบบัญชีนี้ — กรุณาสมัครสมาชิก' });
      const acct = await getAccount(idNumber);
      if (!acct || !acct.passwordHash) return res.status(401).json({ ok: false, error: 'บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน' });
      if (!verifyPassword(password, acct.passwordHash)) return res.status(401).json({ ok: false, error: 'รหัสผ่านไม่ถูกต้อง' });
      return res.status(200).json({ ok: true, user: safeAccount(acct) });
    }

    /* ── (แอดมิน) รีเซ็ตการยืนยันตัวตนของสมาชิกทุกคน ── */
    if (req.body && req.body.adminResetAllKyc) {
      if (!isAdminReq(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
      const r = await resetAllVerifications();
      return res.status(200).json({ ok: true, ...r });
    }

    const e = String(email || '').trim().toLowerCase();
    if (!e) return res.status(400).json({ ok: false, error: 'ระบุ email' });

    const saved = clean(address);
    if (!saved.detail) return res.status(400).json({ ok: false, error: 'กรุณากรอกที่อยู่จัดส่ง' });
    const addresses = await addUserAddress(e, saved);
    return res.status(200).json({ ok: true, address: saved, addresses });
  }

  if (req.method === 'DELETE') {
    const email = (req.query.email || '').trim().toLowerCase();
    const index = Number(req.query.index);
    if (!email) return res.status(400).json({ ok: false, error: 'ระบุ email' });
    if (!Number.isInteger(index)) return res.status(400).json({ ok: false, error: 'ระบุ index' });
    const addresses = await deleteUserAddress(email, index);
    return res.status(200).json({ ok: true, addresses });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
