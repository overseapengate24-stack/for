/**
 * api/topup.js — ระบบเติมเงิน/เครดิต
 * GET  /api/topup?email=...        → ดึงเครดิต + ประวัติเติมเงินของผู้ใช้
 * GET  /api/topup?admin=1          → (แอดมิน) ดึงรายการเติมเงินทั้งหมด  [x-admin-key]
 * POST /api/topup                  → ลูกค้าแจ้งเติมเงิน {email,name,bank,amount,date,time,slip,note}
 * PATCH /api/topup?id=...          → (แอดมิน) อนุมัติ/ปฏิเสธ {action:'approve'|'reject'}  [x-admin-key]
 */

import { createHash } from 'crypto';
import { addTopup, getTopup, updateTopup, deleteTopup, listTopups, getUserCredit, addUserCredit, slipSeen, markSlip, unmarkSlip, addKnownUser } from '../lib/redis.js';

const ADMIN_KEY = (process.env.ADMIN_SECRET_KEY || 'changeme').trim();
const MAX_IMG = 800 * 1024;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    if (req.query.admin) {
      if (String(req.headers['x-admin-key'] || '').trim() !== ADMIN_KEY) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
      const list = await listTopups();
      return res.status(200).json({ ok: true, topups: list });
    }
    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'ระบุ email' });
    const [credit, topups] = await Promise.all([getUserCredit(email), listTopups(email), addKnownUser(email)]);
    return res.status(200).json({ ok: true, credit, topups });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const slip = typeof b.slip === 'string' ? b.slip : '';
    if (!email) return res.status(400).json({ ok: false, error: 'กรุณาเข้าสู่ระบบ' });
    if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(slip)) {
      return res.status(400).json({ ok: false, error: 'กรุณาแนบสลิปการโอน' });
    }
    if (slip.length > MAX_IMG) return res.status(400).json({ ok: false, error: 'รูปสลิปใหญ่เกินไป' });

    /* กันสลิปซ้ำ — ใช้ hash ของรูปสลิป */
    const dedupKey = `img:${createHash('sha256').update(slip).digest('hex')}`;
    if (await slipSeen(dedupKey)) {
      return res.status(409).json({ ok: false, error: 'สลิปนี้ถูกใช้แจ้งเติมเงินไปแล้ว กรุณาแนบสลิปที่ยังไม่เคยใช้' });
    }
    await markSlip(dedupKey);

    const t = {
      dedupKey,
      id: 'TU' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      email,
      name:   String(b.name || '').slice(0, 120),
      bank:   String(b.bank || '').slice(0, 80),
      amount: 0,
      date:   String(b.date || '').slice(0, 20),
      time:   String(b.time || '').slice(0, 20),
      note:   String(b.note || '').slice(0, 300),
      slip,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    await addTopup(t);
    return res.status(200).json({ ok: true, topup: { id: t.id, status: t.status, amount: t.amount } });
  }

  if (req.method === 'PATCH') {
    if (String(req.headers['x-admin-key'] || '').trim() !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const id = String(req.query.id || '').trim();
    const action = String(req.body?.action || '');
    const t = await getTopup(id);
    if (!t) return res.status(404).json({ ok: false, error: 'ไม่พบรายการ' });
    if (t.status !== 'PENDING') return res.status(400).json({ ok: false, error: 'รายการนี้ถูกดำเนินการแล้ว' });

    if (action === 'approve') {
      const amount = Number(req.body?.amount) || 0;
      if (amount <= 0) return res.status(400).json({ ok: false, error: 'กรุณาระบุจำนวนเครดิตที่จะเติม' });
      const credit = await addUserCredit(t.email, amount);
      const up = await updateTopup(id, { status: 'APPROVED', amount });
      return res.status(200).json({ ok: true, topup: up, credit });
    }
    if (action === 'reject') {
      if (t.dedupKey) await unmarkSlip(t.dedupKey); // ปลดล็อกให้แนบสลิปนี้ใหม่ได้
      const up = await updateTopup(id, { status: 'REJECTED' });
      return res.status(200).json({ ok: true, topup: up });
    }
    return res.status(400).json({ ok: false, error: 'action ไม่ถูกต้อง' });
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id || '').trim();
    const t = await getTopup(id);
    if (!t) return res.status(404).json({ ok: false, error: 'ไม่พบรายการ' });
    const isAdmin = String(req.headers['x-admin-key'] || '').trim() === ADMIN_KEY;
    const email = (req.query.email || '').trim().toLowerCase();
    if (!isAdmin && email !== (t.email || '').toLowerCase()) {
      return res.status(403).json({ ok: false, error: 'ลบได้เฉพาะรายการของตนเอง' });
    }
    /* ถ้าเคยอนุมัติ (มีเครดิต) → หักเครดิตคืน และปลดล็อกสลิป */
    if (t.status === 'APPROVED') {
      await addUserCredit(t.email, -Number(t.amount || 0));
      if (t.dedupKey) await unmarkSlip(t.dedupKey);
    }
    await deleteTopup(id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
