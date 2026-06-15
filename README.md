# PR – Backend

Standort-App fuer zwei Personen (du + deine Freundin). Dieses Backend laeuft auf
deinem Debian-Server, speichert Positionen, berechnet Tageswege und schiebt
Live-Positionen ueber WebSocket an die App.

## Was es kann (Stand jetzt)
- Registrieren / Login (Passwort gehasht, Token = JWT, 30 Tage gueltig)
- Gruppe erstellen + per Einladungscode beitreten (nur Gruppenmitglieder sehen sich)
- Position melden (`POST /locations`)
- Tagesweg / Verlauf abrufen (`GET /locations/history`)
- Live-Position aller Mitglieder (`GET /locations/group` + WebSocket `/ws`)
- Orte speichern: Zuhause + beliebig viele weitere (`/places`)

## 1. Voraussetzungen auf Debian installieren

```bash
# Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL + PostGIS (fuer Geo-Funktionen)
sudo apt-get install -y postgresql postgresql-contrib postgis postgresql-postgis
```

## 2. Datenbank anlegen

```bash
sudo -u postgres psql <<'SQL'
CREATE USER pr_user WITH PASSWORD 'DEIN_DB_PASSWORT';
CREATE DATABASE pr OWNER pr_user;
SQL
```

## 3. Projekt einrichten

```bash
cd pr-backend
npm install
cp .env.example .env
# .env oeffnen und DATABASE_URL + JWT_SECRET ausfuellen
nano .env

# Tabellen anlegen
npm run init-db

# Starten
npm start
```

Test, ob es laeuft:

```bash
curl http://localhost:3000/health     # -> {"ok":true}
```

## 4. Schnelltest (ohne App)

```bash
# Registrieren
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"ich@example.com","password":"meinpasswort","displayName":"Ich"}'

# -> du bekommst {"token":"...","user":{...}} zurueck. Token kopieren.

# Gruppe erstellen (TOKEN einsetzen)
curl -X POST http://localhost:3000/groups \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Wir beide"}'

# Position senden
curl -X POST http://localhost:3000/locations \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"lat":48.30,"lng":14.29,"accuracy":8,"battery":80}'

# Verlauf ansehen
curl http://localhost:3000/locations/history \
  -H "Authorization: Bearer TOKEN"
```

## 5. Spaeter: HTTPS (wichtig!)
Standortdaten gehoeren verschluesselt uebertragen. Auf dem Server einen
Reverse-Proxy (Caddy oder Nginx) mit Let's-Encrypt-Zertifikat davorsetzen,
sodass die App `https://deine-domain` statt `http://...:3000` nutzt.
Caddy macht das fast von allein.

## API-Endpunkte
| Methode | Pfad | Zweck |
|---|---|---|
| POST | /auth/register | Konto erstellen |
| POST | /auth/login | Einloggen |
| GET  | /auth/me | Eigenes Konto |
| POST | /groups | Gruppe erstellen |
| POST | /groups/join | Per Code beitreten |
| GET  | /groups | Meine Gruppen |
| POST | /locations | Position melden |
| GET  | /locations/history | Tagesweg (?userId=&from=&to=) |
| GET  | /locations/group | Live-Position aller Mitglieder |
| GET  | /places | Orte auflisten |
| POST | /places | Ort speichern |
| DELETE | /places/:id | Ort loeschen |
| WS   | /ws?token=... | Live-Positionen empfangen |
