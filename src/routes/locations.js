import { pool } from '../db.js';
import { broadcastToGroup } from '../ws.js';

// Pruefen: darf viewer den target sehen? (sich selbst oder Gruppenpartner)
async function canView(viewerId, targetId) {
  if (Number(viewerId) === Number(targetId)) return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM group_members gm1
     JOIN group_members gm2 ON gm1.group_id = gm2.group_id
     WHERE gm1.user_id = $1 AND gm2.user_id = $2 LIMIT 1`,
    [viewerId, targetId]
  );
  return rows.length > 0;
}

// Handy meldet eine neue Position
export async function postLocation(req, res) {
  const { lat, lng, accuracy, speed, heading, battery, recordedAt } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat und lng (Zahlen) erforderlich' });
  }
  const ts = recordedAt ? new Date(recordedAt) : new Date();
  const { rows } = await pool.query(
    `INSERT INTO locations (user_id, geom, accuracy_m, speed_ms, heading_deg, battery, recorded_at)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2,$3),4326)::geography, $4,$5,$6,$7,$8)
     RETURNING id`,
    [req.userId, lng, lat, accuracy ?? null, speed ?? null, heading ?? null, battery ?? null, ts]
  );
  broadcastToGroup(req.userId, { lat, lng, accuracy, battery, recordedAt: ts }).catch(console.error);
  res.json({ ok: true, id: rows[0].id });
}

// Tagesweg / Verlauf einer Person
export async function getHistory(req, res) {
  const targetUserId = Number(req.query.userId) || req.userId;
  if (!(await canView(req.userId, targetUserId))) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  const fromTs = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 24 * 3600 * 1000);
  const toTs = req.query.to ? new Date(req.query.to) : new Date();
  const { rows } = await pool.query(
    `SELECT id, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng,
            accuracy_m, speed_ms, heading_deg, battery, recorded_at
     FROM locations
     WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3
     ORDER BY recorded_at ASC`,
    [targetUserId, fromTs, toTs]
  );
  res.json({ points: rows });
}

// Neueste Position jedes Gruppenmitglieds (fuer die Live-Karte)
export async function getGroupLatest(req, res) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (l.user_id)
            l.user_id, u.display_name,
            ST_Y(l.geom::geometry) AS lat, ST_X(l.geom::geometry) AS lng,
            l.accuracy_m, l.battery, l.recorded_at
     FROM locations l
     JOIN users u ON u.id = l.user_id
     WHERE l.user_id IN (
       SELECT gm2.user_id FROM group_members gm1
       JOIN group_members gm2 ON gm1.group_id = gm2.group_id
       WHERE gm1.user_id = $1
     )
     ORDER BY l.user_id, l.recorded_at DESC`,
    [req.userId]
  );
  res.json({ members: rows });
}
