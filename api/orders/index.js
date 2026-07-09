/**
 * api/orders/index.js
 * POST /api/orders   → บันทึกออเดอร์ใหม่
 * GET  /api/orders   → แอดมิน: ดึงรายการออเดอร์ทั้งหมด (ต้องมี x-admin-key)
 */

import { saveOrder, listOrders, countOrders, nextOrderNo, nextPayNo, getOrder, deleteOrder, getRmbRate, setRmbRate, getPayRate, setPayRate, updateOrder } from '../../lib/redis.js';
import { registerTracking } from '../../lib/seventrack.js';

function randomOrderNo() {
  const d = new Date();
  const p = (n) => ('0' + n).slice(-2);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return `OP${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${r}`;
}

const ADMIN_KEY = (process.env.ADMIN_SECRET_KEY || 'changeme').trim();

/* จัดการออเดอร์ฝากจ่ายเงิน (OVE) อัตโนมัติ:
   - QUOTED (แจ้งราคาแล้ว) ไม่ชำระเกิน 24 ชม. → ยกเลิก
   - PAID (ฝากจ่ายเงินสำเร็จ) ผ่านไปเกิน 24 ชม. → ลบออเดอร์ทิ้ง */
async function expireQuotedPayOrders() {
  let cancelled = 0, deleted = 0;
  try {
    const orders = await listOrders(0, 300);
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    for (const o of orders) {
      if (!o || o.source !== 'pay') continue;
      if (o.status === 'QUOTED' && o.quotedAt && now - new Date(o.quotedAt).getTime() > DAY) {
        await updateOrder(o.orderNo, {
          status: 'CANCELLED',
          statusText: 'ยกเลิก (ไม่ชำระภายใน 1 วัน)',
          cancelledAt: new Date().toISOString(),
        });
        cancelled++;
      } else if (o.status === 'PAID' && o.paidAt && now - new Date(o.paidAt).getTime() > DAY) {
        await deleteOrder(o.orderNo);
        deleted++;
      }
    }
  } catch (e) {}
  return { cancelled, deleted };
}

function cleanAddress(a) {
  const s = (v, n) => String(v || '').slice(0, n);
  return {
    recipient:   s(a?.recipient, 120), phone: s(a?.phone, 40),
    houseNo:     s(a?.houseNo, 60),    moo:   s(a?.moo, 30),  building: s(a?.building, 120),
    soi:         s(a?.soi, 80),        road:  s(a?.road, 80),
    subdistrict: s(a?.subdistrict, 80), district: s(a?.district, 80),
    province:    s(a?.province, 80),    postal: s(a?.postal, 10),
    detail:      s(a?.detail, 600),
  };
}

export default async function handler(req, res) {
  /* CORS preflight */
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  /* ── เรท RMB → THB (อ่านได้ทุกคน · เขียนต้องเป็นแอดมิน) ── */
  if (req.query.rate !== undefined) {
    if (req.method === 'GET') {
      const [rate, payRate] = await Promise.all([getRmbRate(), getPayRate()]);
      return res.status(200).json({ ok: true, rate, payRate });
    }
    if (req.method === 'POST') {
      if (String(req.headers['x-admin-key'] || '').trim() !== ADMIN_KEY) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
      const out = {};
      if (req.body?.rate    !== undefined) out.rate    = await setRmbRate(req.body.rate);
      if (req.body?.payRate !== undefined) out.payRate = await setPayRate(req.body.payRate);
      return res.status(200).json({ ok: true, ...out });
    }
  }

  /* ── ยกเลิกออเดอร์ค้างชำระอัตโนมัติ (เรียกจาก cron หรือ manual) ── */
  if (req.query.expire !== undefined) {
    const r = await expireQuotedPayOrders();
    return res.status(200).json({ ok: true, ...r });
  }

  /* ── GET: แอดมินดึงรายการออเดอร์ ── */
  if (req.method === 'GET') {
    if (String(req.headers['x-admin-key'] || '').trim() !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    /* ทุกครั้งที่แอดมินโหลดรายการ → เช็ค+ยกเลิกออเดอร์ค้างชำระเกิน 1 วันก่อน */
    await expireQuotedPayOrders();
    /* ดึงออเดอร์เดียวตามเลข (สำหรับแอดมินค้นเพื่อแก้ไขการขนส่ง) */
    if (req.query.no) {
      const order = await getOrder(String(req.query.no).trim().toUpperCase());
      return res.status(200).json({ ok: true, order: order || null });
    }
    const page = Number(req.query.page) || 0;
    const size = Number(req.query.size) || 20;
    const [orders, total] = await Promise.all([listOrders(page, size), countOrders()]);
    return res.status(200).json({ ok: true, orders, total, page });
  }

  /* ── DELETE: แอดมินลบออเดอร์ ── */
  if (req.method === 'DELETE') {
    if (String(req.headers['x-admin-key'] || '').trim() !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const no = String(req.query.no || '').trim().toUpperCase();
    if (!no) return res.status(400).json({ ok: false, error: 'ระบุเลขออเดอร์' });
    const existed = await deleteOrder(no);
    if (!existed) return res.status(404).json({ ok: false, error: 'ไม่พบออเดอร์นี้' });
    return res.status(200).json({ ok: true, deleted: no });
  }

  /* ── POST: รับออเดอร์จาก frontend ── */
  if (req.method === 'POST') {
    const body = req.body;

    const isImport = body?.kind === 'import';
    /* validation */
    if (!body?.items?.length) {
      return res.status(400).json({ ok: false, error: 'กรุณาระบุสินค้าอย่างน้อย 1 รายการ' });
    }
    /* ต้องมีช่องทางติดต่ออย่างน้อย 1 อย่าง — email (เข้าสู่ระบบ) หรือ LINE ID */
    if (!body?.customer?.email && !body?.customer?.lineId) {
      return res.status(400).json({ ok: false, error: 'กรุณาเข้าสู่ระบบ หรือระบุ LINE ID' });
    }

    const isPay = body?.source === 'pay';
    let no = '';
    try {
      no = isPay ? await nextPayNo() : await nextOrderNo();
    } catch (err) {
      no = (isPay ? 'OVE-' : '') + randomOrderNo();
    }
    const order = {
      orderNo: no,
      kind:   isImport ? 'import' : 'order',
      source: isImport ? 'import' : (body.source === 'pay' ? 'pay' : 'order'),  /* ที่มาออเดอร์: pay=ฝากจ่ายเงิน, order=ฝากสั่งซื้อ */
      /* ออเดอร์นำเข้า (ลูกค้าส่งของเองมีเลขแทร็คแล้ว) ข้าม NEW/QUOTED/PAID เข้าสู่ขั้น "รอสินค้าเข้าโกดังจีน" ทันที
         เพื่อให้เชื่อมกับระบบติดตามสถานะ + ขั้นบิลเดียวกับออเดอร์สั่งซื้อปกติ */
      status: isImport ? 'ORDERED' : 'NEW',
      statusText: isImport ? 'รอสินค้าเข้าโกดังจีน' : 'กำลังตรวจสอบ',
      trackingNo: (body.trackingNo || '').slice(0, 60),
      shopName:   (body.shopName || '').slice(0, 80),
      shipMethod: (body.shipMethod === 'เรือ' ? 'เรือ' : (body.shipMethod === 'รถ' ? 'รถ' : '')),
      crate:      !!body.crate,
      qc:         !!body.qc,
      productType: (body.productType || '').slice(0, 60),
      boxes:      Math.max(0, Math.min(999, Number(body.boxes) || 0)),
      customer: {
        name:   (body.customer.name  || '').slice(0, 120),
        email:  (body.customer.email || '').slice(0, 200),
        lineId: (body.customer.lineId|| '').slice(0, 80),
        phone:  (body.customer.phone || '').slice(0, 40),
        address: cleanAddress(body.customer.address),
      },
      items: (body.items || []).slice(0, 30).map(it => ({
        url:      (it.url  || '').slice(0, 500),
        shop:     (it.shop || '').slice(0, 120),
        name:     (it.name || '').slice(0, 200),
        color:    (it.color || '').slice(0, 80),
        size:     (it.size || '').slice(0, 80),
        priceRmb: (String(it.priceRmb || '')).slice(0, 20),
        qty:      Math.max(1, Math.min(999, Number(it.qty) || 1)),
        imageUrl: (it.imageUrl || '').slice(0, 2000000),
        note:     (it.note || '').slice(0, 300),
        plat:     (it.plat || '').slice(0, 40),
      })),
      note:      (body.note || '').slice(0, 500),
      total:     '',
      shipping:  '',
      adminNote: '',
      shipStatus: 'PENDING',
      tracking: [{
        step: 'PENDING',
        location: '',
        note: isImport ? 'ลูกค้าแจ้งส่งของเข้าโกดัง — ระบบลงทะเบียนติดตามพัสดุแล้ว' : 'ได้รับคำสั่งซื้อแล้ว รอทีมงานตรวจสอบราคา',
        at: new Date().toISOString(),
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveOrder(order);

    /* ลงทะเบียนเลข Tracking กับ 17track ทันที (ออเดอร์นำเข้ามีเลขแทร็คมาตั้งแต่สร้าง) */
    if (order.trackingNo) { try { await registerTracking(order.trackingNo); } catch (e) {} }

    /* ส่งข้อมูลออเดอร์เข้า Google Sheet (ถ้าตั้ง GSHEET_URL) — ยกเว้นออเดอร์ฝากจ่ายเงิน (OVE) ไม่เก็บลงชีต */
    const GSHEET_URL = (process.env.GSHEET_URL || '').trim();
    if (GSHEET_URL && !isPay) {
      try {
        await fetch(GSHEET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNo: no,
            createdAt: order.createdAt,
            type: isImport ? 'นำเข้า' : (order.source === 'pay' ? 'ฝากจ่ายเงิน' : 'ฝากสั่งซื้อ'),
            customerName: order.customer.name,
            lineId: order.customer.lineId,
            email: order.customer.email,
            trackingNo: order.trackingNo || '',
            shipMethod: order.shipMethod || '',
            crate: order.crate ? 'ใช่' : '',
            qc: order.qc ? 'ใช่' : '',
            note: order.note || '',
            items: order.items.map(it => ({ shop: it.shop, url: it.url, note: it.note, imageUrl: it.imageUrl || '' })),
          }),
        });
      } catch (e) {}
    }

    return res.status(200).json({ ok: true, orderNo: no });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
