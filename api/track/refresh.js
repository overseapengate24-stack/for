/**
 * api/track/refresh.js
 * GET /api/track/refresh?no=OPXXXXXX  → ดึงสถานะสดจาก 17track แล้วเลื่อนสถานะ auto
 *
 * 4 สถานะ: 0=ร้านส่งของ · 1=เข้าโกดังจีน · 2=ส่งมาไทย · 3=โกดังไทย
 *   - 0,1 : ข้อมูลจริงจากขนส่งจีน (17track)
 *   - 2,3 : เลื่อนตามเวลาหลังเข้าโกดังจีน (auto) — แอดมินแก้เองทับได้
 */

import { getOrder, updateOrder } from '../../lib/redis.js';
import { registerTracking, getTrackInfo, normalizeEvents, deliveredTime } from '../../lib/seventrack.js';

const DAY = 86400000;
const SHIP_TO_TH_DAYS = 3;   // ส่งมาไทย: +3 วันหลังเข้าโกดังจีน
const TH_WH_DAYS       = 7;  // โกดังไทย: +7 วันหลังเข้าโกดังจีน

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const no = (req.query.no || '').trim().toUpperCase();
  if (!no) return res.status(400).json({ ok: false, error: 'ระบุเลขออเดอร์' });

  const order = await getOrder(no);
  if (!order) return res.status(200).json({ ok: true, found: false });

  let num = order.trackingNo;
  /* แอดมินส่งเลขที่เพิ่งพิมพ์มา (ยังไม่บันทึก) → ใช้เลขนี้ + ลงทะเบียนทันที */
  const tnOverride = (req.query.tn || '').trim();
  if (tnOverride && tnOverride !== num) {
    num = tnOverride;
    await updateOrder(no, { trackingNo: num });
    await registerTracking(num);
  }
  const curStage = Number.isInteger(order.cnStage) ? order.cnStage : -1;
  if (!num) return res.status(200).json({ ok: true, found: true, cnStage: curStage, events: order.cnEvents || [] });

  /* ดึงข้อมูลจาก 17track */
  const info = await getTrackInfo(num);
  const acc  = info?.data?.accepted?.[0];

  if (!acc || !acc.track_info) {
    /* ยังไม่ได้ลงทะเบียน/ยังไม่มีข้อมูล → ลงทะเบียนไว้ รอ 17track เก็บข้อมูล */
    await registerTracking(num);
    return res.status(200).json({ ok: true, found: true, registering: true, cnStage: curStage, events: order.cnEvents || [] });
  }

  const ti     = acc.track_info;
  const status = ti.latest_status?.status || '';   // InfoReceived/InTransit/Delivered/...
  const events = normalizeEvents(ti);

  let stage = curStage;
  let cnArrivedAt = order.cnArrivedAt || null;

  /* 0 = ร้านส่งของ — มี event หรือกำลังขนส่ง */
  if (events.length || ['InTransit','InfoReceived','PickUp','Undelivered','Exception'].includes(status)) stage = Math.max(stage, 0);
  /* 1 = เข้าโกดังจีน — ขนส่งจีนส่งถึงโกดังเรา (Delivered) */
  if (status === 'Delivered') { stage = Math.max(stage, 1); if (!cnArrivedAt) cnArrivedAt = deliveredTime(ti) || new Date().toISOString(); }

  /* 2,3 = เลื่อนตามเวลาหลังเข้าโกดังจีน */
  if (cnArrivedAt) {
    const days = (Date.now() - new Date(cnArrivedAt).getTime()) / DAY;
    if (days >= SHIP_TO_TH_DAYS) stage = Math.max(stage, 2);
    if (days >= TH_WH_DAYS)      stage = Math.max(stage, 3);
  }

  const patch = { cnStage: stage, cnEvents: events.slice(0, 25) };
  if (cnArrivedAt) patch.cnArrivedAt = cnArrivedAt;

  /* auto เลื่อนสถานะออเดอร์ตามข้อมูลจริงจาก 17track */
  const STATUS_TEXT = { ORDERED:'สั่งซื้อกับร้านจีนแล้ว', SHIPPED:'กำลังจัดส่ง', DONE:'สำเร็จ' };
  let newStatus = order.status;
  if (stage >= 3 && ['PAID','ORDERED','SHIPPED'].includes(order.status)) {
    newStatus = 'DONE';      // ถึงโกดังไทยแล้ว → "สั่งซื้อสำเร็จ"
  } else if (stage >= 1 && (order.status === 'PAID' || order.status === 'ORDERED')) {
    newStatus = 'SHIPPED';   // ถึงโกดังจีนแล้ว → ข้ามไป "ถึงโกดังจีน" เลย
  } else if (stage >= 0 && order.status === 'PAID') {
    newStatus = 'ORDERED';   // มีเลข+กำลังขนส่ง แต่ยังไม่ถึง → "รอสินค้าเข้าโกดังจีน"
  }
  if (newStatus !== order.status) { patch.status = newStatus; if (STATUS_TEXT[newStatus]) patch.statusText = STATUS_TEXT[newStatus]; }

  await updateOrder(no, patch);
  return res.status(200).json({ ok: true, found: true, cnStage: stage, cnArrivedAt, events, status: newStatus });
}
