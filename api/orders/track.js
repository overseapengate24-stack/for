/**
 * api/orders/track.js
 * GET /api/orders/track?no=OPXXXXXX-XXXX  → ดึงสถานะออเดอร์ (public)
 */

import { getOrder, listOrders, countOrders, countKnownUsers, addKnownUser } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  /* ── สถิติหน้าแรก (public): ส่งสำเร็จ + จำนวนลูกค้า ── */
  if (req.query.stats !== undefined) {
    try {
      /* บันทึกผู้ชมที่ล็อกอิน (ส่ง ?me=email มาจากหน้าแรก) */
      const me = String(req.query.me || '').toLowerCase().trim();
      if (me) await addKnownUser(me);
      const total = Number(await countOrders()) || 0;
      const all = await listOrders(0, Math.min(total, 3000));
      let delivered = 0; const emails = new Set();
      for (const o of all) {
        if (o.billStatus === 'DELIVERED') delivered++;
        const em = (o.customer?.email || '').toLowerCase().trim();
        if (em) { emails.add(em); await addKnownUser(em); }
      }
      const known = await countKnownUsers();
      const customers = Math.max(emails.size, known);
      return res.status(200).json({ ok: true, stats: { delivered, customers, orders: total } });
    } catch (e) {
      return res.status(200).json({ ok: true, stats: { delivered: 0, customers: 0, orders: 0 } });
    }
  }

  /* ── ดึงบิลทั้งหมดในกลุ่มรวมบิล ── */
  if (req.query.group) {
    const g = String(req.query.group).trim();
    try {
      const total = Number(await countOrders()) || 0;
      const all = await listOrders(0, Math.min(total, 3000));
      const orders = all.filter(o => o.billGroup === g).map(o => ({
        orderNo: o.orderNo,
        shipping: Number(o.shipping) || 0,
        billWeightKg: Number(o.billWeightKg) || ((Number(o.weight) || 0) / 1000),
        items: (o.items || []).length,
        billStatus: o.billStatus || '',
      }));
      return res.status(200).json({ ok: true, group: g, orders });
    } catch (e) {
      return res.status(200).json({ ok: true, group: g, orders: [] });
    }
  }

  const no = (req.query.no || '').trim().toUpperCase();
  if (!no) return res.status(400).json({ ok: false, error: 'ระบุเลขออเดอร์' });

  const order = await getOrder(no);
  if (!order) return res.status(200).json({ ok: true, found: false });

  /* ส่งเฉพาะข้อมูลที่จำเป็น (ไม่ expose ทั้งหมด) */
  return res.status(200).json({
    ok:         true,
    found:      true,
    orderNo:    order.orderNo,
    status:     order.status,
    statusText: order.statusText,
    total:      order.total,
    shipping:   order.shipping,
    adminNote:  order.adminNote,
    shipStatus: order.shipStatus || 'PENDING',
    trackingNo:   order.trackingNo   || '',
    cnThTrackingNo: order.cnThTrackingNo || '',
    productType:  order.productType || '',
    thTrackingNo: order.thTrackingNo || '',
    weight:       Number(order.weight) || 0,
    shopName:     order.shopName || '',
    shopNote:     order.shopNote || '',
    shopShipAt:   order.shopShipAt || '',
    cnStage:      Number.isInteger(order.cnStage) ? order.cnStage : -1,
    cnArrivedAt:  order.cnArrivedAt || '',
    cnEvents:     Array.isArray(order.cnEvents) ? order.cnEvents : [],
    billL:        Number(order.billL) || 0,
    billW:        Number(order.billW) || 0,
    billH:        Number(order.billH) || 0,
    billCbm:      Number(order.billCbm) || 0,
    billWeightKg: Number(order.billWeightKg) || 0,
    deliveryType:    order.deliveryType || '',
    deliveryCarrier: order.deliveryCarrier || '',
    deliveryNote:    order.deliveryNote || '',
    deliveryChosen:  !!order.deliveryChosen,
    billStatus:      order.billStatus || '',
    billGroup:       order.billGroup || '',
    history:         Array.isArray(order.history) ? order.history : [],
    billConfirmedAt: order.billConfirmedAt || '',
    slipImage:       order.slipImage || '',
    slipSubmittedAt: order.slipSubmittedAt || '',
    shipPhoto:       order.shipPhoto || '',
    shippedThAt:     order.shippedThAt || '',
    tracking:   Array.isArray(order.tracking) ? order.tracking : [],
    note:       order.note || '',
    shipMethod: order.shipMethod || '',
    crate:      !!order.crate,
    qc:         !!order.qc,
    billFee:    Number(order.billFee) || 0,
    discount:   Number(order.discount) || 0,
    cnShipFee:  Number(order.cnShipFee) || 0,
    sackFee:    Number(order.sackFee) || 0,
    crateFee:   Number(order.crateFee) || 0,
    qcFee:      Number(order.qcFee) || 0,
    taxPct:     Number(order.taxPct) || 0,
    thShipFee:  Number(order.thShipFee) || 0,
    items:      Array.isArray(order.items) ? order.items : [],
    customer:   order.customer ? {
      name:   order.customer.name || '',
      lineId: order.customer.lineId || '',
      phone:  order.customer.phone || order.customer.address?.phone || '',
      email:  order.customer.email || '',
      address: order.customer.address || null,
    } : null,
    createdAt:  order.createdAt,
    updatedAt:  order.updatedAt,
  });
}
