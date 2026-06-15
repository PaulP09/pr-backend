import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config.js';
import { register, login, me, authMiddleware } from './auth.js';
import { postLocation, getHistory, getGroupLatest } from './routes/locations.js';
import { listPlaces, createPlace, deletePlace } from './routes/places.js';
import { createGroup, joinGroup, myGroups } from './routes/groups.js';
import { owntracksPub, owntracksConfig } from './routes/owntracks.js';
import { setupWebSocket } from './ws.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Auth
app.post('/auth/register', register);
app.post('/auth/login', login);
app.get('/auth/me', authMiddleware, me);

// Standorte
app.post('/locations', authMiddleware, postLocation);
app.get('/locations/history', authMiddleware, getHistory);
app.get('/locations/group', authMiddleware, getGroupLatest);

// Gespeicherte Orte
app.get('/places', authMiddleware, listPlaces);
app.post('/places', authMiddleware, createPlace);
app.delete('/places/:id', authMiddleware, deletePlace);

// Gruppen
app.post('/groups', authMiddleware, createGroup);
app.post('/groups/join', authMiddleware, joinGroup);
app.get('/groups', authMiddleware, myGroups);

// OwnTracks (Hintergrund-Tracking). /pub nutzt Basic-Auth der App, nicht JWT.
app.post('/owntracks/pub', owntracksPub);
app.get('/owntracks/config', authMiddleware, owntracksConfig);

const server = http.createServer(app);
setupWebSocket(server);

server.listen(config.port, () => {
  console.log(`PR Backend laeuft auf Port ${config.port}`);
});
