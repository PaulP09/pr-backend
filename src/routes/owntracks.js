import { pool } from '../db.js';
import { config } from '../config.js';
import { broadcastToGroup } from '../ws.js';

// OwnTracks identifiziert sich per Basic-Auth oder ?token=.
// Wir akzeptieren den device_token egal ob im Benutzer- oder Passwortfeld.
function tokenCandidates(req) {
  const list = [];
  if (req.query.token) list.push(String(req.query.token));
  const h = req.headers.authorization || '';
  if (h.startsWith('Basic ')) {
    const [user, pass] = Buffer.from(h.slice(6), 'base64').toString().split(':');
    if (pass) list.push(pass);
    if (user) list.push(user);
  }
  return list;
}

// Hierhin POSTet die OwnTracks-App im Hintergrund die Positionen
export async function owntracksPub(req, res) {
  const candidates = tokenCandidates(req);
  if (candidates.length === 0) return res.status(401).json([]);

  const { rows } = await pool.query(
    `SELECT id FROM users WHERE device_token = ANY($1) LIMIT 1`,
    [candidates]
  );
  const user = rows[0];
  if (!user) return res.status(401).json([]);

  const loc = req.body || {};
  // OwnTracks schickt verschiedene Typen (location, transition, lwt ...).
  // Nur echte Positionen interessieren uns, der Rest wird mit [] quittiert.
  if (loc._type !== 'location' || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') {
    return res.json([]);
  }

  const ts = loc.tst ? new Date(loc.tst * 1000) : new Date();
  await pool.query(
    `INSERT INTO locations (user_id, geom, accuracy_m, speed_ms, heading_deg, battery, recorded_at)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2,$3),4326)::geography, $4,$5,$6,$7,$8)`,
    [user.id, loc.lon, loc.lat, loc.acc ?? null, loc.vel ?? null, loc.cog ?? null, loc.batt ?? null, ts]
  );

  broadcastToGroup(user.id, {
    lat: loc.lat,
    lng: loc.lon,
    accuracy: loc.acc,
    battery: loc.batt,
    recordedAt: ts,
  }).catch(console.error);

  res.json([]); // OwnTracks erwartet ein (leeres) JSON-Array
}

// Zeigt dir die genauen Einstellungen, die du in OwnTracks eintippst
export async function owntracksConfig(req, res) {
  const { rows } = await pool.query(
    `SELECT device_token, display_name FROM users WHERE id = $1`,
    [req.userId]
  );
  const u = rows[0];
  const base = config.publicUrl || 'https://DEINE-SERVER-ADRESSE';
  res.json({
    mode: 'HTTP',
    url: `${base}/owntracks/pub`,
    username: u.display_name,        // beliebig, dient nur der Anzeige
    password: u.device_token,        // das ist der Schluessel -> ins Passwortfeld
    hint: 'In OwnTracks: Mode = HTTP, URL eintragen, Passwort = dein Token. ' +
          'Update-Modus "Move" fuer haeufige Updates, "Significant" fuer mehr Akku.',
  });
}
