/**
 * api/address.js
 * GET  /api/address?email=...             → ดึงที่อยู่จัดส่งที่บันทึกไว้ของผู้ใช้
 * POST /api/address                       → บันทึก/อัปเดตที่อยู่จัดส่ง  body:{ email, address:{recipient,phone,detail} }
 * GET  /api/address?email=...&profile=1   → สถานะการยืนยันตัวตน (เลขบัตร ปชช./พาสปอร์ต) — คืนเฉพาะเลขท้ายแบบปกปิด
 * POST /api/address  body:{ email, profile:{ idType:'thai'|'passport', idNumber } } → บันทึกเลขบัตร ปชช./พาสปอร์ต
 */

import { getUserAddresses, addUserAddress, deleteUserAddress, getUserProfile, saveUserProfile } from '../lib/redis.js';

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
    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'ระบุ email' });

    if (req.query.profile) {
      const p = await getUserProfile(email);
      if (!p || !p.idNumber) return res.status(200).json({ ok: true, registered: false });
      return res.status(200).json({
        ok: true,
        registered: true,
        idType: p.idType,
        idMasked: maskId(p.idNumber),
      });
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
