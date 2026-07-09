/**
 * api/orders/update.js
 * PATCH /api/orders/update?no=OPXXXXXX-XXXX
 * Body: { status, total, shipping, adminNote }
 * Header: x-admin-key: <ADMIN_SECRET_KEY>
 */

import { updateOrder, addTrackingEvent, getOrder, addBillHistory } from '../../lib/redis.js';
import { registerTracking } from '../../lib/seventrack.js';
import { sendBillEmail, sendShipEmail, sendQuoteEmail } from '../../lib/email.js';

const VALID_STATUSES = ['NEW','QUOTED','PAID','ORDERED','SHIPPED','DONE','CANCELLED'];
const SHIP_STEPS = ['PENDING','CN_WH','CN_OUT','TH_IN','TH_WH','DELIVERING','DELIVERED'];
const ADMIN_KEY = (process.env.ADMIN_SECRET_KEY || 'changeme').trim();

const STATUS_TEXT = {
  NEW:       'กำลังตรวจสอบ',
  QUOTED:    'รอชำระเงิน',
  PAID:      'รอเลขขนส่งจีน',
  ORDERED:   'รอสินค้าเข้าโกดังจีน',
  SHIPPED:   'สินค้าถึงโกดังจีน/กำลังขนส่ง',
  DONE:      'ถึงโกดังไทย',
  CANCELLED: 'ยกเลิก',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'PATCH') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  /* auth */
  if (String(req.headers['x-admin-key'] || '').trim() !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const no = (req.query.no || '').trim().toUpperCase();
  if (!no) return res.status(400).json({ ok: false, error: 'ระบุเลขออเดอร์' });

  const { status, total, shipping, adminNote, shipStatus, tracking, addTracking, customer, note,
          shipMethod, crate, qc, billFee, discount, trackingNo, thTrackingNo, weight, shopName,
          shopNote, shopShipAt } = req.body || {};

  /* ── เพิ่ม checkpoint การขนส่งหนึ่งจุด (append) ── */
  if (addTracking) {
    const step = SHIP_STEPS.includes(addTracking.step) ? addTracking.step : 'PENDING';
    const entry = {
      step,
      location: String(addTracking.location || '').slice(0, 120),
      note:     String(addTracking.note     || '').slice(0, 300),
      at:       new Date().toISOString(),
    };
    const updated = await addTrackingEvent(no, entry, step);
    if (!updated) return res.status(404).json({ ok: false, error: 'ไม่พบออเดอร์นี้' });
    return res.status(200).json({ ok: true, order: updated });
  }

  const patch = {};
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: `status ต้องเป็นหนึ่งใน: ${VALID_STATUSES.join(', ')}` });
    }
    patch.status     = status;
    patch.statusText = STATUS_TEXT[status];
    /* แจ้งราคาแล้ว (QUOTED) — จับเวลาเพื่อยกเลิกอัตโนมัติถ้าเกิน 1 วันไม่ชำระ */
    if (status === 'QUOTED') patch.quotedAt = new Date().toISOString();
    /* แอดมินอนุมัติการชำระ (PAID) → เคลียร์ธงรอตรวจสอบ + จับเวลา (ออเดอร์ฝากจ่ายเงินจะถูกลบอัตโนมัติหลัง 1 วัน) */
    if (status === 'PAID') { patch.payReview = false; patch.paidAt = new Date().toISOString(); }
  }
  if (req.body?.priceRmb !== undefined) patch.priceRmb = Number(req.body.priceRmb) || 0;
  if (total     !== undefined) patch.total     = String(total);
  if (shipping  !== undefined) patch.shipping  = String(shipping);
  if (adminNote !== undefined) patch.adminNote = String(adminNote).slice(0, 500);
  if (note      !== undefined) patch.note      = String(note).slice(0, 500);
  /* ── ฟิลด์ใบสั่งซื้อ (PO) ── */
  if (shipMethod !== undefined) patch.shipMethod = String(shipMethod).slice(0, 20);
  if (crate      !== undefined) patch.crate      = !!crate;
  if (qc         !== undefined) patch.qc         = !!qc;
  if (billFee    !== undefined) patch.billFee    = Number(billFee) || 0;
  if (discount   !== undefined) patch.discount   = Number(discount) || 0;
  /* ── เลขแทรค: trackingNo = เลขขนส่งจีน, thTrackingNo = เลขขนส่งไทย ── */
  if (trackingNo   !== undefined) patch.trackingNo   = String(trackingNo).slice(0, 60);
  if (thTrackingNo !== undefined) patch.thTrackingNo = String(thTrackingNo).slice(0, 60);
  if (req.body?.cnThTrackingNo !== undefined) patch.cnThTrackingNo = String(req.body.cnThTrackingNo).slice(0, 60);
  if (req.body?.productType !== undefined) patch.productType = String(req.body.productType).slice(0, 60);
  if (weight       !== undefined) patch.weight       = Number(weight) || 0;
  if (shopName     !== undefined) patch.shopName     = String(shopName).slice(0, 80);
  if (shopNote     !== undefined) patch.shopNote     = String(shopNote).slice(0, 200);
  if (shopShipAt   !== undefined) patch.shopShipAt   = String(shopShipAt).slice(0, 40);
  if (req.body?.billStatus !== undefined) {
    patch.billStatus = String(req.body.billStatus).slice(0, 20);
    if (patch.billStatus === 'SHIPPED') patch.shippedThAt = new Date().toISOString();
  }
  if (req.body?.slipImage  !== undefined) patch.slipImage  = String(req.body.slipImage).slice(0, 2_000_000);
  if (req.body?.adminSlip  !== undefined) patch.adminSlip  = String(req.body.adminSlip).slice(0, 2_000_000);
  if (req.body?.payReview  !== undefined) patch.payReview  = !!req.body.payReview;
  if (req.body?.shipPhoto  !== undefined) patch.shipPhoto  = String(req.body.shipPhoto).slice(0, 2_000_000);
  /* สถานะขนส่ง 4 ขั้น (แอดมินแก้ไขเองได้): -1..3 */
  if (req.body?.cnStage !== undefined) {
    patch.cnStage = Math.max(-1, Math.min(3, parseInt(req.body.cnStage, 10) || -1));
    /* ถึง "โกดังไทย" (3) → เลื่อนออเดอร์เป็น "สั่งซื้อสำเร็จ" เสมอ (ยกเว้นถูกยกเลิก) */
    if (patch.cnStage === 3 && patch.status !== 'CANCELLED') {
      patch.status = 'DONE'; patch.statusText = STATUS_TEXT.DONE;
    }
  }
  /* มิติ/น้ำหนักสำหรับบิลค่าขนส่ง */
  ['billL','billW','billH','billCbm','billWeightKg',
   'cnShipFee','sackFee','crateFee','qcFee','taxPct','thShipFee'].forEach(k => {
    if (req.body?.[k] !== undefined) patch[k] = Number(req.body[k]) || 0;
  });

  /* ── แก้ไขข้อมูลลูกค้า ── */
  if (customer && typeof customer === 'object') {
    const existing = await getOrder(no);
    patch.customer = {
      name:   String(customer.name   || '').slice(0, 120),
      email:  String(customer.email  || '').slice(0, 200),
      lineId: String(customer.lineId || '').slice(0, 80),
      phone:  String(customer.phone  || '').slice(0, 40),
    };
    /* ที่อยู่: ถ้าส่งมาจึงเขียนทับ — ถ้าไม่ส่ง คงที่อยู่เดิมของลูกค้า (กันที่อยู่ในบิลหาย) */
    if (customer.address && typeof customer.address === 'object') {
      patch.customer.address = (a => { const s=(v,n)=>String(v||'').slice(0,n); return {
        recipient:s(a?.recipient,120), phone:s(a?.phone,40),
        houseNo:s(a?.houseNo,60), moo:s(a?.moo,30), building:s(a?.building,120),
        soi:s(a?.soi,80), road:s(a?.road,80),
        subdistrict:s(a?.subdistrict,80), district:s(a?.district,80),
        province:s(a?.province,80), postal:s(a?.postal,10), detail:s(a?.detail,600),
      };})(customer.address);
    } else if (existing?.customer?.address) {
      patch.customer.address = existing.customer.address;
    }
  }

  /* ── สถานะการขนส่งปัจจุบัน ── */
  if (shipStatus !== undefined) {
    if (!SHIP_STEPS.includes(shipStatus)) {
      return res.status(400).json({ ok: false, error: `shipStatus ต้องเป็นหนึ่งใน: ${SHIP_STEPS.join(', ')}` });
    }
    patch.shipStatus = shipStatus;
  }

  /* ── แก้ไข/ลบ ไทม์ไลน์ทั้งชุด (replace) ── */
  if (Array.isArray(tracking)) {
    patch.tracking = tracking.slice(0, 60).map(t => ({
      step:     SHIP_STEPS.includes(t.step) ? t.step : 'PENDING',
      location: String(t.location || '').slice(0, 120),
      note:     String(t.note     || '').slice(0, 300),
      at:       t.at || new Date().toISOString(),
    }));
  }

  const prev = await getOrder(no);
  /* ฝากจ่ายเงิน (OVE) ชำระสำเร็จ → ใช้ข้อความ "ฝากจ่ายเงินสำเร็จ" */
  if (patch.status === 'PAID' && prev?.source === 'pay') patch.statusText = 'ฝากจ่ายเงินสำเร็จ';
  const updated = await updateOrder(no, patch);
  if (!updated) return res.status(404).json({ ok: false, error: 'ไม่พบออเดอร์นี้' });

  /* ลงทะเบียนเลข Tracking จีนกับ 17track อัตโนมัติ (เพื่อให้ระบบดึงสถานะสดได้) */
  if (patch.trackingNo) { try { await registerTracking(patch.trackingNo); } catch (e) {} }

  /* ฝากจ่ายเงิน (OVE): แอดมินกดแจ้งราคา/บันทึกซ้ำขณะ "รอชำระเงิน" (QUOTED) → ส่งอีเมลแจ้งราคาให้ลูกค้า (กดบันทึกซ้ำ = ส่งใหม่) */
  if (patch.status === 'QUOTED' && updated.source === 'pay') {
    try { await sendQuoteEmail(updated); } catch (e) {}
  }
  /* แอดมินยืนยันค่าบริการ → "รอชำระเงิน" → ส่งอีเมลแจ้งยอดบิลให้ลูกค้า */
  if (patch.billStatus === 'AWAIT_PAY') { try { await sendBillEmail(updated); } catch (e) {} }
  /* แอดมินใส่เลขขนส่งไทย → "จัดส่งแล้ว" → ส่งอีเมลแจ้งเลขแทร็คให้ลูกค้า */
  if (patch.billStatus === 'SHIPPED') { try { await sendShipEmail(updated); } catch (e) {} }

  /* ── บันทึกประวัติบิล ── */
  try {
    const g = (o => { const n=k=>Number(o[k])||0; const sub=n('shipping')+n('cnShipFee')+n('sackFee')+n('crateFee')+n('qcFee')+n('billFee')-n('discount'); return sub-sub*(n('taxPct')/100); })(updated);
    const baht = v => `ยอดชำระ ${Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ฿`;
    let h = null;
    if (patch.billStatus === 'AWAIT_PAY') h = { action: 'แก้ไขค่าบริการในบิล (รอชำระเงิน)', note: 'เจ้าหน้าที่ · ' + baht(g) };
    else if (patch.billStatus === 'PAID') h = { action: 'ตรวจสอบยอดเงิน — เจ้าหน้าที่ อนุมัติ', note: baht(g) };
    else if (patch.billStatus === 'SHIPPED') h = { action: 'เจ้าหน้าที่ จัดส่งแล้ว', note: `เลขแทร็ค ${updated.thTrackingNo||'-'} · ${updated.deliveryCarrier||''}`.trim() };
    else if (patch.billStatus === 'DELIVERED') h = { action: 'เจ้าหน้าที่ จัดส่งของเรียบร้อย', note: baht(g) };
    else if (billFee !== undefined || req.body?.cnShipFee !== undefined || shipping !== undefined) h = { action: 'แก้ไขค่าบริการในบิล', note: 'เจ้าหน้าที่ · ' + baht(g) };
    if (h) await addBillHistory(no, h);
  } catch (e) {}

  return res.status(200).json({ ok: true, order: updated });
}
