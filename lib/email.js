/**
 * lib/email.js — ส่งอีเมลผ่าน Gmail SMTP (nodemailer)
 * ต้องตั้ง env vars:
 *   GMAIL_USER         = overseapengate24@gmail.com
 *   GMAIL_APP_PASSWORD = รหัส App Password 16 ตัว (ไม่ต้องมีช่องว่าง)
 */

import nodemailer from 'nodemailer';

const SITE = 'https://oversea-pengate.vercel.app';

function billNoOf(o) {
  const d = new Date(o.updatedAt || o.createdAt || Date.now());
  const code = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = (o.orderNo || '').replace(/\D/g, '').slice(-4) || '0000';
  return `BL${code}-${seq}`;
}
function fmt(n) { return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function grandOf(o) {
  const num = (k) => Number(o[k]) || 0;
  const subtotal = num('shipping') + num('cnShipFee') + num('sackFee') + num('crateFee') + num('qcFee') + num('billFee') - num('discount');
  const tax = subtotal * (num('taxPct') / 100);
  return subtotal - tax;
}
const DTYPE = { pickup: 'รับเอง', warehouse: 'โกดังจัดส่ง', private: 'ขนส่งเอกชน' };
function deliveryText(o) {
  const t = DTYPE[o.deliveryType] || '-';
  return o.deliveryType === 'private' ? `${t} ${o.deliveryCarrier || ''}`.trim() : t;
}

async function send(to, subject, html) {
  const user = (process.env.GMAIL_USER || '').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass || !to) return { ok: false, skipped: true };
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from: `Oversea PenGate <${user}>`,
      to, subject, html,
    });
    return { ok: true, id: info.messageId };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/* อีเมล "แจ้งราคาสินค้า — รอชำระเงิน" (ฝากจ่ายเงิน OVE) */
export async function sendQuoteEmail(order) {
  const to = (order?.customer?.email || '').trim();
  if (!to) return { ok: false, skipped: true };

  const total = Number(order.total) || 0;
  const rmb = Number(order.priceRmb) || 0;
  const rate = rmb > 0 ? total / rmb : 0;
  const link = `${SITE}/how-pay.html`;

  const html = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:560px;margin:0 auto;color:#3C3526">
    <div style="background:linear-gradient(90deg,#B89865,#9C8654);color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
      <div style="font-size:18px;font-weight:700">Oversea PenGate</div>
      <div style="font-size:13px;opacity:.9">💴 แจ้งราคาสินค้า — รอชำระเงิน</div>
    </div>
    <div style="border:1px solid #ECE2CE;border-top:0;border-radius:0 0 12px 12px;padding:22px">
      <p>เรียน ลูกค้า ${order.customer?.name || ''}</p>
      <p style="font-weight:700;color:#63522C">เลขที่ออเดอร์ : ${order.orderNo}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 0;color:#7C715B">สถานะ</td><td style="padding:4px 0;text-align:right;font-weight:600">รอชำระเงิน</td></tr>
        ${rmb>0 ? `<tr><td style="padding:4px 0;color:#7C715B">ราคาสินค้า</td><td style="padding:4px 0;text-align:right;font-weight:600">¥${fmt(rmb)}</td></tr>` : ''}
        ${rate>0 ? `<tr><td style="padding:4px 0;color:#7C715B">เรทวันนี้</td><td style="padding:4px 0;text-align:right;font-weight:600">1 หยวน = ${fmt(rate)} บาท</td></tr>` : ''}
      </table>
      <div style="border-top:2px solid #E7DBC0;margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;font-size:16px">
        <span style="font-weight:700">ยอดที่ต้องชำระ</span>
        <span style="font-weight:700;color:#63522C">${fmt(total)} บาท</span>
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;color:#854d0e;border-radius:10px;padding:12px 14px;font-size:13px;margin-top:16px">
        ⏰ กรุณาโอนเงินและแนบสลิป <b>ภายใน 1 วัน</b> มิฉะนั้นออเดอร์จะถูกยกเลิกอัตโนมัติ
      </div>
      <p style="margin-top:18px;font-size:14px">ดูรายการและดำเนินการชำระเงินได้ที่</p>
      <a href="${link}" style="display:inline-block;background:#9C8654;color:#fff;text-decoration:none;padding:11px 22px;border-radius:9px;font-weight:700">เปิดหน้าฝากจ่ายเงิน →</a>
      <p style="margin-top:18px;font-size:12px;color:#B0A48C">อีเมลนี้ส่งอัตโนมัติจากระบบ Oversea PenGate</p>
    </div>
  </div>`;

  return send(to, `[Oversea PenGate] 💴 แจ้งราคา ${order.orderNo} · ${fmt(total)} บาท`, html);
}

/* อีเมล "แจ้งยอดบิลค่าขนส่ง — รอชำระเงิน" */
export async function sendBillEmail(order) {
  const to = (order?.customer?.email || '').trim();
  if (!to) return { ok: false, skipped: true };

  const billNo = billNoOf(order);
  const grand = grandOf(order);
  const row = (k, v) => `<tr><td style="padding:4px 0;color:#7C715B">${k}</td><td style="padding:4px 0;text-align:right;font-weight:600">${v}</td></tr>`;
  const link = `${SITE}/bill-detail.html?no=${encodeURIComponent(order.orderNo)}`;

  const html = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:560px;margin:0 auto;color:#3C3526">
    <div style="background:linear-gradient(90deg,#B89865,#9C8654);color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
      <div style="font-size:18px;font-weight:700">Oversea PenGate</div>
      <div style="font-size:13px;opacity:.9">แจ้งยอดบิลค่าขนส่ง</div>
    </div>
    <div style="border:1px solid #ECE2CE;border-top:0;border-radius:0 0 12px 12px;padding:22px">
      <p>เรียน ลูกค้า ${order.customer?.name || ''}</p>
      <p style="font-weight:700;color:#63522C">เลขที่บิล : ${billNo}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${row('สถานะ', 'รอชำระเงิน')}
        ${row('ค่าขนส่งจีน-ไทย', fmt(order.shipping))}
        ${row('ค่าจัดส่งในจีน', fmt(order.cnShipFee))}
        ${row('ค่ากระสอบ', fmt(order.sackFee))}
        ${row('ค่าตีลังไม้', fmt(order.crateFee))}
        ${row('ค่าบริการ QC', fmt(order.qcFee))}
        ${row('ค่าบริการ', fmt(order.billFee))}
        ${Number(order.discount)>0 ? row('ส่วนลด', '-'+fmt(order.discount)) : ''}
        ${row('การจัดส่ง', deliveryText(order))}
      </table>
      <div style="border-top:2px solid #E7DBC0;margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;font-size:16px">
        <span style="font-weight:700">ยอดเงินสุทธิที่ต้องชำระ</span>
        <span style="font-weight:700;color:#63522C">${fmt(grand)} บาท</span>
      </div>
      <p style="margin-top:18px;font-size:14px">รบกวนลูกค้าเข้าไปตรวจสอบรายการ ดำเนินการชำระเงิน และแนบสลิปในระบบได้ที่</p>
      <a href="${link}" style="display:inline-block;background:#9C8654;color:#fff;text-decoration:none;padding:11px 22px;border-radius:9px;font-weight:700">เปิดหน้าบิล →</a>
      <p style="margin-top:18px;font-size:12px;color:#B0A48C">อีเมลนี้ส่งอัตโนมัติจากระบบ Oversea PenGate</p>
    </div>
  </div>`;

  return send(to, `[Oversea PenGate] แจ้งยอดบิล ${billNo}`, html);
}

/* อีเมล "จัดส่งแล้ว" — แจ้งเลขขนส่งไทยให้ลูกค้าติดตาม */
export async function sendShipEmail(order) {
  const to = (order?.customer?.email || '').trim();
  if (!to) return { ok: false, skipped: true };

  const billNo = billNoOf(order);
  const tn = order.thTrackingNo || '-';
  const carrier = order.deliveryCarrier || order.deliveryType || '';
  const link = `${SITE}/bill-detail.html?no=${encodeURIComponent(order.orderNo)}`;

  const html = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:560px;margin:0 auto;color:#3C3526">
    <div style="background:linear-gradient(90deg,#0ea5e9,#0369a1);color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
      <div style="font-size:18px;font-weight:700">Oversea PenGate</div>
      <div style="font-size:13px;opacity:.9">🚚 พัสดุของคุณจัดส่งแล้ว</div>
    </div>
    <div style="border:1px solid #ECE2CE;border-top:0;border-radius:0 0 12px 12px;padding:22px">
      <p>เรียน ลูกค้า ${order.customer?.name || ''}</p>
      <p>พัสดุบิล <b>${billNo}</b> ออกจากโกดังไทยและกำลังจัดส่งถึงคุณแล้ว 🎉</p>
      <div style="background:#e0f2fe;border:1px solid #bae6fd;border-radius:12px;padding:16px;margin:14px 0;text-align:center">
        <div style="font-size:12.5px;color:#0369a1">เลขขนส่ง (Tracking No)</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#0369a1">${tn}</div>
        ${carrier ? `<div style="font-size:12.5px;color:#0369a1;margin-top:4px">ขนส่ง: ${carrier}</div>` : ''}
      </div>
      <p style="font-size:14px">นำเลขขนส่งไปติดตามสถานะได้ที่เว็บ/แอปของบริษัทขนส่ง หรือดูรายละเอียดบิลได้ที่</p>
      <a href="${link}" style="display:inline-block;background:#0369a1;color:#fff;text-decoration:none;padding:11px 22px;border-radius:9px;font-weight:700">ดูรายละเอียดบิล →</a>
      <p style="margin-top:18px;font-size:12px;color:#B0A48C">ขอบคุณที่ใช้บริการ Oversea PenGate · อีเมลนี้ส่งอัตโนมัติ</p>
    </div>
  </div>`;

  return send(to, `[Oversea PenGate] 🚚 จัดส่งแล้ว ${billNo} · ${tn}`, html);
}
