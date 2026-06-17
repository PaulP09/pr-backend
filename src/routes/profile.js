import { pool } from '../db.js';

// Profilbild setzen. Das Bild kommt als data-URL (vom Browser klein gerechnet).
export async function setAvatar(req, res) {
  const { avatar } = req.body || {};
  if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Bild fehlt oder ungueltig' });
  }
  if (avatar.length > 1500000) {
    return res.status(413).json({ error: 'Bild zu gross' });
  }
  await pool.query(`UPDATE users SET avatar = $1 WHERE id = $2`, [avatar, req.userId]);
  res.json({ ok: true });
}
