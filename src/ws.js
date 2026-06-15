import { WebSocketServer } from 'ws';
import { verifyToken } from './auth.js';
import { pool } from './db.js';

// userId -> Set offener Verbindungen
const clients = new Map();

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    let userId;
    try {
      userId = verifyToken(token).uid;
    } catch {
      ws.close(4001, 'unauthorized');
      return;
    }

    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(ws);

    ws.on('close', () => clients.get(userId)?.delete(ws));
  });

  console.log('WebSocket bereit unter /ws');
}

// Neue Position live an alle Gruppenmitglieder schicken
export async function broadcastToGroup(fromUserId, payload) {
  const { rows } = await pool.query(
    `SELECT DISTINCT gm2.user_id FROM group_members gm1
     JOIN group_members gm2 ON gm1.group_id = gm2.group_id
     WHERE gm1.user_id = $1`,
    [fromUserId]
  );
  const msg = JSON.stringify({ type: 'location', userId: fromUserId, ...payload });
  for (const { user_id } of rows) {
    const set = clients.get(Number(user_id));
    if (!set) continue;
    for (const ws of set) {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    }
  }
}
