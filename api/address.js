/**
 * api/address.js
 * GET  /api/address?email=...   → ดึงที่อยู่จัดส่งที่บันทึกไว้ของผู้ใช้
 * POST /api/address             → บันทึก/อัปเดตที่อยู่จัดส่ง  body:{ email, address:{recipient,phone,detail} }
 */

import { getUserAddresses, addUserAddress, deleteUserAddress } from '../lib/redis.js';

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
    const addresses = await getUserAddresses(email);
    return res.status(200).json({
      ok: true,
      addresses,
      address: addresses.length ? addresses[addresses.length - 1] : null, // compat
    });
  }

  if (req.method === 'POST') {
    const { email, address } = req.body || {};
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
