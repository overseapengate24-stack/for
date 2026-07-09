/**
 * api/orders/set-address.js
 * POST /api/orders/set-address  → ลูกค้าตั้งที่อยู่จัดส่งบนออเดอร์ของตัวเอง
 * body: { orderNo, email, address }
 * ยืนยันสิทธิ์ด้วย email ที่ตรงกับเจ้าของออเดอร์ (ไม่ต้องใช้ admin key)
 */

import { getOrder, updateOrder, addUserAddress } from '../../lib/redis.js';

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
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { orderNo, email, address, saveToBook } = req.body || {};
  const no = String(orderNo || '').trim().toUpperCase();
  const e  = String(email || '').trim().toLowerCase();
  if (!no || !e) return res.status(400).json({ ok: false, error: 'ระบุเลขออเดอร์ + email' });

  const order = await getOrder(no);
  if (!order) return res.status(404).json({ ok: false, error: 'ไม่พบออเดอร์นี้' });

  /* ยืนยันสิทธิ์: email ต้องตรงกับเจ้าของออเดอร์ */
  if ((order.customer?.email || '').toLowerCase() !== e) {
    return res.status(403).json({ ok: false, error: 'อีเมลไม่ตรงกับเจ้าของออเดอร์' });
  }

  const addr = clean(address);
  if (!addr.detail) return res.status(400).json({ ok: false, error: 'กรุณากรอกที่อยู่จัดส่ง' });

  const customer = {
    ...(order.customer || {}),
    name:  addr.recipient || order.customer?.name || '',
    phone: addr.phone || order.customer?.phone || '',
    address: addr,
  };
  const updated = await updateOrder(no, { customer });

  /* บันทึกเข้าสมุดที่อยู่ของผู้ใช้ด้วย (ถ้าระบุ) */
  if (saveToBook) { try { await addUserAddress(e, addr); } catch (err) {} }

  return res.status(200).json({ ok: true, address: addr, order: updated });
}
