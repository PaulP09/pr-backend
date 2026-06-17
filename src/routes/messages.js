import { pool } from '../db.js';
import { sendToGroup } from '../ws.js';

// Die (erste) Gruppe des Nutzers – fuer ein Paar gibt es genau eine.
async function firstGroupId(userId) {
  const { rows } = await pool.query(
    `SELECT group_id FROM group_members WHERE user_id = $1 ORDER BY joined_at LIMIT 1`,
    [userId]
  );
  return rows[0]?.group_id || null;
}

export async function listMessages(req, res) {
  const gid = await firstGroupId(req.userId);
  if (!gid) return res.json({ messages: [] });
  const { rows } = await pool.query(
    `SELECT m.id, m.user_id, m.body, m.created_at, u.display_name, u.avatar
     FROM messages m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = $1
     ORDER BY m.created_at DESC
     LIMIT 100`,
    [gid]
  );
  res.json({ messages: rows.reverse() });
}

export async function postMessage(req, res) {
  const body = ((req.body && req.body.body) || '').trim();
  if (!body) return res.status(400).json({ error: 'Leere Nachricht' });
  if (body.length > 2000) return res.status(400).json({ error: 'Nachricht zu lang' });

  const gid = await firstGroupId(req.userId);
  if (!gid) return res.status(400).json({ error: 'Du bist in keiner Gruppe' });

  const { rows } = await pool.query(
    `INSERT INTO messages (group_id, user_id, body) VALUES ($1,$2,$3)
     RETURNING id, created_at`,
    [gid, req.userId, body]
  );
  const u = await pool.query(`SELECT display_name, avatar FROM users WHERE id = $1`, [req.userId]);

  const message = {
    id: rows[0].id,
    userId: req.userId,
    body,
    createdAt: rows[0].created_at,
    name: u.rows[0].display_name,
    avatar: u.rows[0].avatar,
  };
  // live an die Gruppe (inkl. eigener Geraete; das Frontend entdoppelt per id)
  sendToGroup(req.userId, { type: 'chat', ...message }).catch(console.error);
  res.json({ message });
}
