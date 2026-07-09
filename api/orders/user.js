/**
 * api/orders/user.js
 * GET /api/orders/user?email=...  → ดึงออเดอร์ของผู้ใช้ตาม email
 */

import { listOrdersByUser } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, error: 'ระบุ email ของผู้ใช้' });

  const orders = await listOrdersByUser(email);
  return res.status(200).json({ ok: true, orders });
}
