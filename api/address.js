/**
 * api/address.js
 * GET  /api/address?email=...             → ดึงที่อยู่จัดส่งที่บันทึกไว้ของผู้ใช้
 * POST /api/address                       → บันทึก/อัปเดตที่อยู่จัดส่ง  body:{ email, address:{recipient,phone,detail} }
 * GET  /api/address?email=...&profile=1   → สถานะการยืนยันตัวตน (เลขบัตร ปชช./พาสปอร์ต) — คืนเฉพาะเลขท้ายแบบปกปิด
 * POST /api/address  body:{ email, profile:{ idType:'thai'|'passport', idNumber } } → บันทึกเลขบัตร ปชช./พาสปอร์ต
 */

import { getUserAddresses, addUserAddress, deleteUserAddress, getUserProfile, saveUserProfile, getAccount, saveAccount, addKnownUser, listAccounts, getAccountImage, saveAccountImage } from '../lib/redis.js';

const ADMIN_KEY_ENV = () => (process.env.ADMIN_SECRET_KEY || 'changeme').trim();
const isAdminReq = (req) => String(req.headers['x-admin-key'] || '').trim() === ADMIN_KEY_ENV();

/* เลขบัตรประชาชนไทย 13 หลัก — ตรวจ checksum ตามสูตร mod 11 */
function validThaiId(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}
function validPassport(no) {
  return /^[A-Za-z0-9]{6,12}$/.test(no);
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
      const ADMIN_KEY = (process.env.ADMIN_SECRET_KEY || 'changeme').trim();
      if (String(req.headers['x-admin-key'] || '').trim() !== ADMIN_KEY) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
      }
      const members = await listAccounts();
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
    const { email, address, profile, register, login } = req.body || {};

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

    /* ── เข้าสู่ระบบด้วยเลขบัตร ปชช./พาสปอร์ต ── */
    if (login) {
      const idNumber = String(login.idNumber || '').trim().toUpperCase();
      if (!idNumber) return res.status(400).json({ ok: false, error: 'กรุณากรอกเลขบัตรประชาชน หรือเลขพาสปอร์ต' });
      const acct = await getAccount(idNumber);
      return res.status(200).json({ ok: true, account: acct || null });
    }

    /* ── สมัครสมาชิก ── */
    if (register) {
      const name = String(register.name || '').trim().slice(0, 120);
      const idType = register.idType === 'passport' ? 'passport' : 'thai';
      const idNumber = String(register.idNumber || '').trim().toUpperCase();
      const rEmail = String(register.email || '').trim().toLowerCase().slice(0, 120);
      if (!name) return res.status(400).json({ ok: false, error: 'กรุณากรอกชื่อ-นามสกุล' });
      if (idType === 'thai' && !validThaiId(idNumber)) {
        return res.status(400).json({ ok: false, error: 'เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
      }
      if (idType === 'passport' && !validPassport(idNumber)) {
        return res.status(400).json({ ok: false, error: 'เลขพาสปอร์ตไม่ถูกต้อง (ตัวอักษร/ตัวเลข 6–12 หลัก)' });
      }
      if (rEmail && !/^\S+@\S+\.\S+$/.test(rEmail)) {
        return res.status(400).json({ ok: false, error: 'รูปแบบอีเมลไม่ถูกต้อง' });
      }
      /* รูปถ่ายบัตร ปชช./พาสปอร์ต — บังคับแนบตอนสมัคร ให้แอดมินตรวจเทียบเลข */
      const idImage = String(register.idImage || '');
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(idImage)) {
        return res.status(400).json({ ok: false, error: 'กรุณาแนบรูปถ่ายบัตรประชาชน หรือหน้าพาสปอร์ต' });
      }
      if (idImage.length > 900000) {
        return res.status(400).json({ ok: false, error: 'รูปใหญ่เกินไป กรุณาลองใหม่' });
      }
      const existing = await getAccount(idNumber);
      if (existing) return res.status(409).json({ ok: false, error: 'เลขนี้มีบัญชีอยู่แล้ว — กรุณากดเข้าสู่ระบบ' });
      // ถ้าไม่ให้อีเมล ใช้อีเมลภายในจากเลขบัตรเป็น key ของออเดอร์/ที่อยู่แทน
      const acctEmail = rEmail || `id_${idNumber.toLowerCase()}@member.opg`;
      const acct = { name, idType, idNumber, email: acctEmail, contactEmail: rEmail, verifyStatus: 'PENDING', createdAt: new Date().toISOString() };
      await saveAccountImage(idNumber, idImage);
      await saveAccount(idNumber, acct);
      await saveUserProfile(acctEmail, { idType, idNumber, registeredAt: acct.createdAt });
      try { await addKnownUser(acctEmail); } catch (e2) {}
      return res.status(200).json({ ok: true, account: acct });
    }

    const e = String(email || '').trim().toLowerCase();
    if (!e) return res.status(400).json({ ok: false, error: 'ระบุ email' });

    if (profile) {
      const idType = profile.idType === 'passport' ? 'passport' : 'thai';
      const idNumber = String(profile.idNumber || '').trim().toUpperCase();
      if (idType === 'thai' && !validThaiId(idNumber)) {
        return res.status(400).json({ ok: false, error: 'เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
      }
      if (idType === 'passport' && !validPassport(idNumber)) {
        return res.status(400).json({ ok: false, error: 'เลขพาสปอร์ตไม่ถูกต้อง (ตัวอักษร/ตัวเลข 6–12 หลัก)' });
      }
      await saveUserProfile(e, { idType, idNumber, registeredAt: new Date().toISOString() });
      return res.status(200).json({ ok: true, registered: true, idType, idMasked: maskId(idNumber) });
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
