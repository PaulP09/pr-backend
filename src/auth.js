import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from './db.js';
import { config } from './config.js';

export function signToken(userId) {
  return jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export async function register(req, res) {
  const { email, password, displayName } = req.body || {};
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'email, password, displayName erforderlich' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Passwort braucht mind. 8 Zeichen' });
  }
  const hash = await bcrypt.hash(password, 12);
  const deviceToken = crypto.randomBytes(24).toString('hex');
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, device_token)
       VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, device_token`,
      [String(email).toLowerCase(), hash, displayName, deviceToken]
    );
    const user = rows[0];
    res.json({ token: signToken(user.id), user });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-Mail bereits vergeben' });
    console.error(e);
    res.status(500).json({ error: 'Serverfehler' });
  }
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  const { rows } = await pool.query(
    `SELECT id, email, display_name, password_hash FROM users WHERE email = $1`,
    [String(email || '').toLowerCase()]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
    return res.status(401).json({ error: 'Falsche E-Mail oder Passwort' });
  }
  res.json({
    token: signToken(user.id),
    user: { id: user.id, email: user.email, display_name: user.display_name },
  });
}

// Schuetzt Routen: nur mit gueltigem Token
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Kein Token' });
  try {
    req.userId = verifyToken(token).uid;
    next();
  } catch {
    res.status(401).json({ error: 'Ungueltiges Token' });
  }
}

export async function me(req, res) {
  const { rows } = await pool.query(
    `SELECT id, email, display_name, device_token, avatar, bio FROM users WHERE id = $1`,
    [req.userId]
  );
  res.json({ user: rows[0] });
}
