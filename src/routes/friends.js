import { pool } from '../db.js';

// Alle Freunde = alle, die mit dir mindestens eine Gruppe teilen (ohne dich selbst)
export async function listFriends(req, res) {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.id, u.display_name, u.avatar, u.bio
     FROM group_members gm1
     JOIN group_members gm2 ON gm1.group_id = gm2.group_id
     JOIN users u ON u.id = gm2.user_id
     WHERE gm1.user_id = $1 AND gm2.user_id <> $1
     ORDER BY u.display_name`,
    [req.userId]
  );
  res.json({ friends: rows });
}
