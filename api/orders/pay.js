/**
 * api/orders/pay.js
 * POST /api/orders/pay?no=OPxxxx  body:{ email }
 * ชำระเงินออเดอร์ด้วยเครดิตในระบบ → ตัดเครดิต + เปลี่ยนสถานะเป็น PAID
 */

import { getOrder, updateOrder, getUserCredit, deductCredit, getRmbRate } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const no = (req.query.no || '').trim().toUpperCase();
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!no || !email) return res.status(400).json({ ok: false, error: 'ข้อมูลไม่ครบ' });

  const order = await getOrder(no);
  if (!order) return res.status(404).json({ ok: false, error: 'ไม่พบออเดอร์' });
  if ((order.customer?.email || '').toLowerCase() !== email) {
    return res.status(403).json({ ok: false, error: 'ชำระได้เฉพาะออเดอร์ของตนเอง' });
  }
  if (!['NEW', 'QUOTED'].includes(order.status)) {
    return res.status(400).json({ ok: false, error: 'ออเดอร์นี้ชำระเงินไปแล้ว หรือไม่อยู่ในสถานะที่ชำระได้' });
  }

  const RMB_RATE = await getRmbRate();
  /* ราคาสินค้า: ใช้ที่แอดมินตั้ง ถ้ายังไม่ตั้ง → คิดจากสินค้า (RMB × เรทที่แอดมินตั้ง) อัตโนมัติ */
  let productTotal = Number(order.total) || 0;
  if (productTotal <= 0) {
    const rmb = (order.items || []).reduce((s, it) => s + (Number(it.priceRmb) || 0) * (Number(it.qty) || 1), 0);
    productTotal = Math.round(rmb * RMB_RATE * 100) / 100;
  }
  const amount = productTotal + (Number(order.shipping) || 0)
               + (Number(order.billFee) || 0) - (Number(order.discount) || 0);
  if (amount <= 0) return res.status(400).json({ ok: false, error: 'ยอดชำระไม่ถูกต้อง (ราคาสินค้าเป็น 0 หรือติดลบ)' });

  /* deductCredit เช็คซ้ำในตัวและปฏิเสธถ้าจะติดลบ — เรา return 402 ล่วงหน้าเพื่อให้ client จัดการง่าย */
  const credit = await getUserCredit(email);
  if (credit < amount) {
    return res.status(402).json({ ok: false, error: 'เครดิตไม่เพียงพอ กรุณาเติมเงินก่อน', credit, amount, need: amount - credit, topupUrl: '/topup.html' });
  }
  let newCredit;
  try {
    newCredit = await deductCredit(email, amount);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_CREDIT') {
      return res.status(402).json({ ok: false, error: 'เครดิตไม่เพียงพอ กรุณาเติมเงินก่อน', credit: err.balance, amount, need: err.shortBy, topupUrl: '/topup.html' });
    }
    throw err;
  }
  const updated = await updateOrder(no, { status: 'PAID', statusText: 'รอเลขขนส่งจีน', total: String(productTotal), paidAt: new Date().toISOString() });
  return res.status(200).json({ ok: true, credit: newCredit, amount, order: { orderNo: updated.orderNo, status: updated.status } });
}
