import crypto from 'crypto';
import { pool } from '../db.js';

export async function createGroup(req, res) {
  const name = (req.body && req.body.name) || 'PR';
  const code = crypto.randomBytes(4).toString('hex');
  const { rows } = await pool.query(
    `INSERT INTO groups (name, invite_code) VALUES ($1,$2) RETURNING id, name, invite_code`,
    [name, code]
  );
  const group = rows[0];
  await pool.query(`INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)`, [
    group.id,
    req.userId,
  ]);
  res.json({ group });
}

export async function joinGroup(req, res) {
  const inviteCode = req.body && req.body.inviteCode;
  const { rows } = await pool.query(`SELECT id FROM groups WHERE invite_code = $1`, [inviteCode]);
  if (!rows[0]) return res.status(404).json({ error: 'Code ungueltig' });
  await pool.query(
    `INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [rows[0].id, req.userId]
  );
  res.json({ ok: true, groupId: rows[0].id });
}

export async function myGroups(req, res) {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.invite_code
     FROM groups g JOIN group_members m ON m.group_id = g.id
     WHERE m.user_id = $1`,
    [req.userId]
  );
  res.json({ groups: rows });
}
