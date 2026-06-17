-- PostGIS aktivieren (fuer Geo-Abfragen wie "bin ich zu Hause?")
CREATE EXTENSION IF NOT EXISTS postgis;

-- Benutzer (du und deine Freundin)
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  device_token  TEXT UNIQUE,           -- fuer OwnTracks (Hintergrund-Tracking)
  avatar        TEXT,                  -- Profilbild als data-URL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Migration fuer bereits bestehende Installationen:
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Gruppe (z.B. "Wir beide"). Nur Mitglieder sehen sich gegenseitig.
CREATE TABLE IF NOT EXISTS groups (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id  BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Jede einzelne Positionsmeldung (daraus entstehen die Tageswege)
CREATE TABLE IF NOT EXISTS locations (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  geom        geography(Point, 4326) NOT NULL,
  accuracy_m  DOUBLE PRECISION,
  speed_ms    DOUBLE PRECISION,
  heading_deg DOUBLE PRECISION,
  battery     INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_locations_user_time ON locations(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_geom ON locations USING GIST(geom);

-- Gespeicherte Orte (Zuhause + beliebig viele weitere)
CREATE TABLE IF NOT EXISTS places (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  geom       geography(Point, 4326) NOT NULL,
  radius_m   DOUBLE PRECISION NOT NULL DEFAULT 100,
  is_home    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_places_user ON places(user_id);

-- Gruppen-Chat
CREATE TABLE IF NOT EXISTS messages (
  id         BIGSERIAL PRIMARY KEY,
  group_id   BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_group_time ON messages(group_id, created_at);
