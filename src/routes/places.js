import { pool } from '../db.js';

export async function listPlaces(req, res) {
  const { rows } = await pool.query(
    `SELECT id, name, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng,
            radius_m, is_home
     FROM places WHERE user_id = $1 ORDER BY is_home DESC, name`,
    [req.userId]
  );
  res.json({ places: rows });
}

export async function createPlace(req, res) {
  const { name, lat, lng, radius, isHome } = req.body || {};
  if (!name || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'name, lat, lng erforderlich' });
  }
  const { rows } = await pool.query(
    `INSERT INTO places (user_id, name, geom, radius_m, is_home)
     VALUES ($1,$2, ST_SetSRID(ST_MakePoint($3,$4),4326)::geography, $5, $6)
     RETURNING id`,
    [req.userId, name, lng, lat, radius ?? 100, !!isHome]
  );
  res.json({ ok: true, id: rows[0].id });
}

export async function deletePlace(req, res) {
  await pool.query(`DELETE FROM places WHERE id = $1 AND user_id = $2`, [req.params.id, req.userId]);
  res.json({ ok: true });
}
