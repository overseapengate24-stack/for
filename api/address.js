/**
 * api/address.js
 * GET  /api/address?email=...             → ดึงที่อยู่จัดส่งที่บันทึกไว้ของผู้ใช้
 * POST /api/address                       → บันทึก/อัปเดตที่อยู่จัดส่ง  body:{ email, address:{recipient,phone,detail} }
 * GET  /api/address?email=...&profile=1   → สถานะการยืนยันตัวตน (เลขบัตร ปชช.) — คืนเฉพาะเลขท้ายแบบปกปิด
 * POST /api/address  body:{ email, profile:{ idNumber } } → บันทึกเลขบัตร ปชช.
 */

import { getUserAddresses, addUserAddress, deleteUserAddress, getUserProfile, saveUserProfile, getAccount, saveAccount, addKnownUser, listAccounts, getAccountImage, saveAccountImage, saveGoogleUser, listGoogleUsers, resetAllVerifications, bindEmailToId, getIdByEmail } from '../lib/redis.js';
import { ocrThaiIdFront, compareFaces } from '../lib/iapp.js';
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
function maskId(no) {
  const s = String(no || '');
  return s.length <= 4 ? s : '•'.repeat(s.length - 4) + s.slice(-4);
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
      /* รวมบัญชี Google ที่เคยล็อกอิน เข้ากับข้อมูลยืนยันตัวตน (เลขบัตร) */
      const [gus, accts] = await Promise.all([listGoogleUsers(), listAccounts()]);
      const byEmail = new Map();
      for (const g of gus) {
        byEmail.set(g.email, {
          name: g.name || '', email: g.email, picture: g.picture || '',
          lastLoginAt: g.lastLoginAt || '', createdAt: g.firstLoginAt || g.lastLoginAt || '',
        });
      }
      for (const a of accts) {
        const key = String(a.email || '').toLowerCase();
        const base = byEmail.get(key) || { name: a.name || '', email: key, picture: '', createdAt: a.createdAt || '' };
        byEmail.set(key, {
          ...base,
          name: a.name || base.name || '',
          phone: a.phone || base.phone || '',
          idNumber: a.idNumber, idType: a.idType, verifyStatus: a.verifyStatus,
          kycProvider: a.kycProvider, kycScore: a.kycScore, kycAt: a.kycAt,
          createdAt: base.createdAt || a.createdAt || '',
        });
      }
      const members = [...byEmail.values()].sort((x, y) =>
        String(y.lastLoginAt || y.createdAt || '').localeCompare(String(x.lastLoginAt || x.createdAt || '')));
      return res.status(200).json({ ok: true, members });
    }

    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'ระบุ email' });

    if (req.query.profile) {
      const p = await getUserProfile(email);
      if (!p || !p.idNumber) return res.status(200).json({ ok: true, registered: false });
      const out = {
        ok: true,
        registered: true,
        idType: p.idType,
        idMasked: maskId(p.idNumber),
      };
      // แอดมินขอเลขเต็ม (สำหรับพิธีการศุลกากร) — ต้องแนบ x-admin-key ที่ถูกต้อง
      const ADMIN_KEY = (process.env.ADMIN_SECRET_KEY || 'changeme').trim();
      if (req.query.full && String(req.headers['x-admin-key'] || '').trim() === ADMIN_KEY) {
        out.idNumber = p.idNumber;
      }
      return res.status(200).json(out);
    }

    const addresses = await getUserAddresses(email);
    return res.status(200).json({
      ok: true,
      addresses,
      address: addresses.length ? addresses[addresses.length - 1] : null, // compat
    });
  }

  if (req.method === 'POST') {
    const { email, address, profile } = req.body || {};

    /* ── สมัครสมาชิกใหม่ ── */
    if (req.body && req.body.register) {
      const r = req.body.register;
      const name = String(r.name || '').trim().slice(0, 120);
      const phone = String(r.phone || '').trim().replace(/[^\d+-]/g, '').slice(0, 20);
      const email = String(r.email || '').trim().toLowerCase().slice(0, 120);
      const password = String(r.password || '');
      const confirmPassword = String(r.confirmPassword || '');
      const idNumber = String(r.idNumber || '').trim();
      if (!name) return res.status(400).json({ ok: false, error: 'กรุณากรอกชื่อ-นามสกุล' });
      if (!phone || phone.replace(/\D/g, '').length < 9) return res.status(400).json({ ok: false, error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ ok: false, error: 'รูปแบบอีเมลไม่ถูกต้อง' });
      if (password.length < 6) return res.status(400).json({ ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
      if (password !== confirmPassword) return res.status(400).json({ ok: false, error: 'รหัสผ่านไม่ตรงกัน' });
      if (!validThaiId(idNumber)) return res.status(400).json({ ok: false, error: 'เลขบัตรประชาชนไม่ถูกต้อง' });
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

    /* ── (แอดมิน) ขอรูปบัตรของสมาชิก ── */
    if (req.body && req.body.adminGetIdImage) {
      if (!isAdminReq(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
      const idNumber = String(req.body.adminGetIdImage.idNumber || '').trim().toUpperCase();
      if (!idNumber) return res.status(400).json({ ok: false, error: 'ระบุเลขบัตร' });
      const image = await getAccountImage(idNumber);
      return res.status(200).json({ ok: true, image: image || null });
    }

    /* ── (แอดมิน) อนุมัติ/ปฏิเสธการยืนยันตัวตนของสมาชิก ── */
    if (req.body && req.body.verify) {
      if (!isAdminReq(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
      const idNumber = String(req.body.verify.idNumber || '').trim().toUpperCase();
      const action = req.body.verify.action === 'approve' ? 'APPROVED' : 'REJECTED';
      const acct = await getAccount(idNumber);
      if (!acct) return res.status(404).json({ ok: false, error: 'ไม่พบสมาชิก' });
      acct.verifyStatus = action;
      acct.verifiedAt = new Date().toISOString();
      await saveAccount(idNumber, acct);
      return res.status(200).json({ ok: true, account: acct });
    }

    const e = String(email || '').trim().toLowerCase();
    if (!e) return res.status(400).json({ ok: false, error: 'ระบุ email' });

    /* ── e-KYC step 1: OCR หน้าบัตรประชาชน ── */
    if (req.body && req.body.kycOcr) {
      const image = String(req.body.kycOcr.image || '');
      if (!/^data:image\//.test(image)) return res.status(400).json({ ok: false, error: 'ไม่มีรูปบัตร' });
      if (image.length > 1500000) return res.status(400).json({ ok: false, error: 'รูปใหญ่เกินไป ลองย่อขนาดก่อน' });
      try {
        const r = await ocrThaiIdFront(image);
        if (!r.idNumber || !/^\d{13}$/.test(r.idNumber)) {
          return res.status(422).json({ ok: false, error: 'อ่านเลขบัตรไม่สำเร็จ ลองถ่ายใหม่ในที่แสงสว่างกว่านี้', detail: r.detectionScore });
        }
        return res.status(200).json({
          ok: true,
          idNumber: r.idNumber,
          name: r.thName || r.enName || '',
          dob: r.dob,
          faceBase64: r.faceBase64,
          detectionScore: r.detectionScore,
        });
      } catch (err) {
        return res.status(502).json({ ok: false, error: err.message || 'เรียก iApp OCR ไม่สำเร็จ' });
      }
    }

    /* ── e-KYC step 2: เทียบใบหน้าเซลฟี่กับรูปในบัตร ── */
    if (req.body && req.body.kycVerify) {
      const { idNumber, name, cardFace, selfie } = req.body.kycVerify;
      const id = String(idNumber || '').trim();
      if (!/^\d{13}$/.test(id)) return res.status(400).json({ ok: false, error: 'เลขบัตรไม่ถูกต้อง' });
      if (!cardFace || !selfie) return res.status(400).json({ ok: false, error: 'ขาดรูปสำหรับเทียบใบหน้า' });
      // เตรียม data URL ถ้ามาเป็น base64 ล้วน
      const asDataUrl = (s) => (/^data:/.test(s) ? s : `data:image/jpeg;base64,${s}`);
      try {
        const cmp = await compareFaces(asDataUrl(cardFace), asDataUrl(selfie), 0.5);
        if (!cmp.match) {
          return res.status(200).json({ ok: false, verified: false, score: cmp.score, error: `ใบหน้าไม่ตรงกับบัตร (คะแนน ${Math.round(cmp.score*100)}%)` });
        }
        // บันทึกลงบัญชี
        const acctEmail = String(req.body.email || '').trim().toLowerCase();
        const now = new Date().toISOString();
        const existing = await getAccount(id);
        const existingEmail = String((existing && existing.email) || '').trim().toLowerCase();
        // 409 เฉพาะกรณีอันตราย: มีบัญชีเดิม + มีอีเมลชัดเจน + อีเมลไม่ตรง + verify ผ่านแล้ว
        // (บัญชีเก่าไม่มี email หรือยังไม่ approve → อนุญาตให้เขียนทับได้)
        if (existing && existingEmail && existingEmail !== acctEmail && existing.verifyStatus === 'APPROVED') {
          return res.status(409).json({ ok: false, error: 'เลขนี้ถูกใช้กับบัญชีอื่นแล้ว — กรุณาติดต่อแอดมิน' });
        }
        // เก็บรูปบัตร (crop) + เซลฟี่ ไว้ใน account:img สำหรับให้แอดมินเห็น
        await saveAccountImage(id, asDataUrl(cardFace));
        await saveAccount(id, {
          name: String(name || (existing && existing.name) || '').slice(0, 120),
          idType: 'thai', idNumber: id,
          email: acctEmail, contactEmail: acctEmail,
          verifyStatus: 'APPROVED',           // e-KYC ผ่านอัตโนมัติ
          kycProvider: 'iapp',
          kycScore: Number(cmp.score.toFixed(4)),
          kycAt: now,
          createdAt: (existing && existing.createdAt) || now,
        });
        await saveUserProfile(acctEmail, { idType: 'thai', idNumber: id, registeredAt: now, kycScore: Number(cmp.score.toFixed(4)) });
        try { await addKnownUser(acctEmail); } catch (e2) {}
        return res.status(200).json({ ok: true, verified: true, score: cmp.score });
      } catch (err) {
        return res.status(502).json({ ok: false, error: err.message || 'เรียก iApp Face Compare ไม่สำเร็จ' });
      }
    }

    /* ── บันทึกการล็อกอิน Google (เรียกจากหน้าเว็บหลัง sign-in) ── */
    if (req.body && req.body.googleUser) {
      const g = req.body.googleUser;
      await saveGoogleUser(e, {
        name: String(g.name || '').slice(0, 120),
        picture: String(g.picture || '').slice(0, 500),
        lastLoginAt: new Date().toISOString(),
      });
      try { await addKnownUser(e); } catch (e2) {}
      return res.status(200).json({ ok: true });
    }

    if (profile) {
      const idNumber = String(profile.idNumber || '').trim();
      const name = String(profile.name || '').trim().slice(0, 120);
      if (!validThaiId(idNumber)) {
        return res.status(400).json({ ok: false, error: 'เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
      }
      /* รูปถ่ายบัตรประชาชน — บังคับแนบ เพื่อให้แอดมินตรวจเทียบเลขได้ */
      const idImage = String(profile.idImage || '');
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(idImage)) {
        return res.status(400).json({ ok: false, error: 'กรุณาแนบรูปถ่ายบัตรประชาชน' });
      }
      if (idImage.length > 900000) {
        return res.status(400).json({ ok: false, error: 'รูปใหญ่เกินไป กรุณาลองใหม่' });
      }
      /* เลขนี้ถูกผูกกับบัญชีอีเมลอื่นแล้วหรือไม่ */
      const existing = await getAccount(idNumber);
      if (existing && String(existing.email || '').toLowerCase() !== e) {
        return res.status(409).json({ ok: false, error: 'เลขนี้ถูกใช้กับบัญชีอื่นแล้ว — หากเป็นเลขของท่านจริง กรุณาติดต่อแอดมิน' });
      }
      const now = new Date().toISOString();
      await saveAccountImage(idNumber, idImage);
      await saveAccount(idNumber, {
        name: name || (existing && existing.name) || '',
        idType: 'thai', idNumber,
        email: e, contactEmail: e,
        verifyStatus: 'PENDING',
        createdAt: (existing && existing.createdAt) || now,
      });
      await saveUserProfile(e, { idType: 'thai', idNumber, registeredAt: now });
      try { await addKnownUser(e); } catch (e2) {}
      return res.status(200).json({ ok: true, registered: true, idType: 'thai', idMasked: maskId(idNumber) });
    }
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
