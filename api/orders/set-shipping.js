/**
 * api/orders/set-shipping.js  (customer self-service, email-verified — ไม่ต้องใช้ admin key)
 * POST /api/orders/set-shipping
 *   action: 'shipping' (default) → เลือกวิธีจัดส่ง { deliveryType, deliveryCarrier, deliveryNote }
 *   action: 'confirm'            → ยืนยันบิล → ตรวจสอบค่าบริการ (billStatus=REVIEW)
 *   action: 'slip'               → แนบสลิปชำระเงิน { slip(dataURL) } (billStatus=SLIP)
 */

import { getOrder, updateOrder } from '../../lib/redis.js';

const TYPES = ['pickup', 'warehouse', 'private'];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const body = req.body || {};
  const action = String(body.action || 'shipping');
  const no = String(body.orderNo || '').trim().toUpperCase();
  const e  = String(body.email || '').trim().toLowerCase();
  if (!no || !e) return res.status(400).json({ ok: false, error: 'ระบุเลขออเดอร์ + email' });

  const order = await getOrder(no);
  if (!order) return res.status(404).json({ ok: false, error: 'ไม่พบออเดอร์นี้' });
  if ((order.customer?.email || '').toLowerCase() !== e) {
    return res.status(403).json({ ok: false, error: 'อีเมลไม่ตรงกับเจ้าของออเดอร์' });
  }

  /* ── ยืนยันบิล → ตรวจสอบค่าบริการ ── */
  if (action === 'confirm') {
    if (!order.customer?.address?.detail) return res.status(400).json({ ok: false, error: 'กรุณาระบุที่อยู่จัดส่งก่อน' });
    if (!order.deliveryChosen) return res.status(400).json({ ok: false, error: 'กรุณาเลือกวิธีจัดส่งก่อน' });
    const updated = await updateOrder(no, { billStatus: 'REVIEW', billConfirmedAt: new Date().toISOString() });
    return res.status(200).json({ ok: true, order: updated });
  }

  /* ── แนบสลิปชำระเงิน → ตรวจสอบยอดเงิน ── */
  if (action === 'slip') {
    const s = String(body.slip || '');
    if (!s.startsWith('data:image/')) return res.status(400).json({ ok: false, error: 'ไฟล์สลิปไม่ถูกต้อง' });
    if (s.length > 2_000_000) return res.status(400).json({ ok: false, error: 'รูปใหญ่เกินไป กรุณาลองใหม่' });
    const updated = await updateOrder(no, { slipImage: s, slipSubmittedAt: new Date().toISOString(), billStatus: 'SLIP' });
    return res.status(200).json({ ok: true, order: updated });
  }

  /* ── เลือกวิธีจัดส่ง (ค่าเริ่มต้น) ── */
  const type = TYPES.includes(body.deliveryType) ? body.deliveryType : 'private';
  if (type === 'private' && !String(body.deliveryCarrier || '').trim()) {
    return res.status(400).json({ ok: false, error: 'กรุณาเลือกขนส่งเอกชน' });
  }
  const updated = await updateOrder(no, {
    deliveryType:    type,
    deliveryCarrier: String(body.deliveryCarrier || '').slice(0, 60),
    deliveryNote:    String(body.deliveryNote || '').slice(0, 200),
    deliveryChosen:  true,
  });
  return res.status(200).json({ ok: true, order: updated });
}
