/**
 * api/orders/bill-action.js
 * POST /api/orders/bill-action → การกระทำของลูกค้าบนบิล (ยืนยันสิทธิ์ด้วย email)
 * body: { action:'confirm'|'slip'|'group', orderNo, orderNos?, email, slip? }
 *   - confirm : ลูกค้ายืนยันบิล → billStatus='REVIEW' (ส่งแอดมินตรวจค่าบริการ)
 *   - slip    : ลูกค้าแนบสลิป → billStatus='SLIP'   (ส่งแอดมินตรวจยอดเงิน)
 *   - group   : รวมหลายบิลเป็นกลุ่มเดียว → ตั้ง billGroup=BG... บนทุกบิล
 */

import { getOrder, updateOrder, addBillHistory } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { action, orderNo, orderNos, email, slip } = req.body || {};
  const e  = String(email || '').trim().toLowerCase();

  /* ── รวมบิลเป็นกลุ่ม ── */
  if (action === 'group') {
    const list = Array.isArray(orderNos) ? orderNos.map(x => String(x).trim().toUpperCase()).filter(Boolean) : [];
    if (!e || list.length < 2) return res.status(400).json({ ok: false, error: 'เลือกบิลอย่างน้อย 2 รายการเพื่อรวมกลุ่ม' });
    const d = new Date();
    const groupId = `BG${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    for (const n of list) {
      const o = await getOrder(n);
      if (!o) return res.status(404).json({ ok: false, error: `ไม่พบบิล ${n}` });
      if ((o.customer?.email || '').toLowerCase() !== e) return res.status(403).json({ ok: false, error: 'อีเมลไม่ตรงกับเจ้าของบิล' });
      if (['SHIPPED','DELIVERED'].includes(o.billStatus)) return res.status(400).json({ ok: false, error: `บิล ${n} จัดส่งแล้ว รวมกลุ่มไม่ได้` });
    }
    for (const n of list) { await updateOrder(n, { billGroup: groupId }); }
    return res.status(200).json({ ok: true, groupId });
  }

  const no = String(orderNo || '').trim().toUpperCase();
  if (!no || !e) return res.status(400).json({ ok: false, error: 'ระบุเลขออเดอร์ + email' });

  const order = await getOrder(no);
  if (!order) return res.status(404).json({ ok: false, error: 'ไม่พบออเดอร์นี้' });
  if ((order.customer?.email || '').toLowerCase() !== e) {
    return res.status(403).json({ ok: false, error: 'อีเมลไม่ตรงกับเจ้าของออเดอร์' });
  }

  if (action === 'confirm') {
    if (!order.customer?.address?.detail) return res.status(400).json({ ok: false, error: 'กรุณาระบุที่อยู่จัดส่งก่อน' });
    if (!order.deliveryChosen)            return res.status(400).json({ ok: false, error: 'กรุณาเลือกวิธีจัดส่งก่อน' });
    const updated = await updateOrder(no, { billStatus: 'REVIEW', billConfirmedAt: new Date().toISOString() });
    try { await addBillHistory(no, { action: 'แจ้งวางบิล (เลือกการจัดส่ง)', note: 'ลูกค้า · ' + (order.deliveryCarrier || order.deliveryType || '') }); } catch (e) {}
    return res.status(200).json({ ok: true, order: updated });
  }

  /* ── ฝากจ่ายเงิน (OVE): ลูกค้าแนบสลิป → รอแอดมินตรวจสอบ ── */
  if (action === 'paySlip') {
    if (order.status !== 'QUOTED') return res.status(400).json({ ok: false, error: 'ออเดอร์นี้ไม่อยู่ในสถานะรอชำระเงิน' });
    const s = String(slip || '');
    if (!s.startsWith('data:image/')) return res.status(400).json({ ok: false, error: 'ไฟล์สลิปไม่ถูกต้อง' });
    if (s.length > 2_000_000)         return res.status(400).json({ ok: false, error: 'รูปใหญ่เกินไป กรุณาลองใหม่' });
    const updated = await updateOrder(no, { slipImage: s, slipSubmittedAt: new Date().toISOString(), payReview: true });
    return res.status(200).json({ ok: true, order: updated });
  }

  if (action === 'slip') {
    const s = String(slip || '');
    if (!s.startsWith('data:image/')) return res.status(400).json({ ok: false, error: 'ไฟล์สลิปไม่ถูกต้อง' });
    if (s.length > 2_000_000)         return res.status(400).json({ ok: false, error: 'รูปใหญ่เกินไป กรุณาลองใหม่' });
    const updated = await updateOrder(no, { slipImage: s, slipSubmittedAt: new Date().toISOString(), billStatus: 'SLIP' });
    const g = (o => { const n=k=>Number(o[k])||0; const sub=n('shipping')+n('cnShipFee')+n('sackFee')+n('crateFee')+n('qcFee')+n('billFee')-n('discount'); return sub-sub*(n('taxPct')/100); })(updated);
    try { await addBillHistory(no, { action: 'ลูกค้าแจ้งชำระเงิน', note: `ยอด ${g.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ฿ · ${updated.deliveryCarrier||updated.deliveryType||''}`.trim() }); } catch (e) {}
    return res.status(200).json({ ok: true, order: updated });
  }

  return res.status(400).json({ ok: false, error: 'action ไม่ถูกต้อง' });
}
