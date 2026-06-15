# PR auf den Server bringen – Schritt für Schritt

Du brauchst nur deinen SSH-Zugang. Es gibt zwei Wege, die Dateien
hochzuladen – **Weg A (GitHub)** ist für den Anfang am einfachsten.

---

## Weg A – über GitHub (empfohlen)

Vorteil: kein Datei-Gefummel im Terminal, und Updates später sind ein Befehl.

### 1. Repo bei GitHub anlegen
- Auf github.com einloggen (kostenloses Konto reicht).
- Oben rechts **+ → New repository**.
- Name z.B. `pr`, auf **Private** stellen, **Create repository**.

### 2. Dateien hochladen (im Browser, kein Terminal)
- Im neuen Repo: **Add file → Upload files**.
- Den **Inhalt** des entpackten `pr-backend`-Ordners reinziehen
  (also `package.json`, `install.sh`, den Ordner `src/` usw.).
- Unten **Commit changes**.

### 3. Auf dem Server einloggen und holen
```bash
ssh dein-user@deine-server-adresse

# git ist nach dem Installer eh dabei, zur Sicherheit:
sudo apt-get update && sudo apt-get install -y git

# Repo klonen (NICHT als root – einfach als dein normaler User)
git clone https://github.com/DEIN-NAME/pr.git
cd pr
```

### 4. Installieren
```bash
sudo bash install.sh
```
Das Skript macht jetzt alles allein. Am Ende zeigt es dir ein DB-Passwort
und wie du testen kannst.

### Später: Update einspielen
```bash
cd pr
git pull
npm install
sudo systemctl restart pr-backend
```

---

## Weg B – direkt hochladen (scp)

Falls du kein GitHub willst. Das machst du **auf deinem eigenen PC**
(nicht auf dem Server), dort wo die `pr-backend.zip` liegt:

```bash
scp pr-backend.zip dein-user@deine-server-adresse:~
```
(fragt nach demselben Passwort wie dein SSH-Login)

Dann auf dem Server:
```bash
ssh dein-user@deine-server-adresse
sudo apt-get update && sudo apt-get install -y unzip
unzip pr-backend.zip
cd pr-backend
sudo bash install.sh
```

---

## Testen, ob es läuft
```bash
curl http://localhost:3000/health      # -> {"ok":true}
systemctl status pr-backend            # sollte "active (running)" zeigen
journalctl -u pr-backend -f            # Live-Logs (mit Strg+C raus)
```

Wenn `{"ok":true}` kommt, läuft das Backend. 🎉

---

## Was läuft jetzt?
- Das Backend lauscht auf **Port 3000**, nur lokal auf dem Server.
- Es startet automatisch nach jedem Neustart (systemd-Dienst `pr-backend`).
- Erreichbar von außen (fürs iPhone / OwnTracks) ist es **noch nicht** –
  das ist der nächste Schritt: **HTTPS + öffentliche Adresse**.

## Häufige Stolpersteine
- **`sudo bash install.sh` schlägt fehl bei „permission denied“ auf den Ordner:**
  Du hast vermutlich als `root` geklont. Klone als dein normaler User in
  dein Home-Verzeichnis (`cd ~` dann `git clone ...`).
- **Port 3000 schon belegt:** in `.env` `PORT=3001` setzen und
  `sudo systemctl restart pr-backend`.
- **Datenbankfehler:** prüfe `journalctl -u pr-backend -e` – meist stimmt
  die `DATABASE_URL` in `.env` nicht.
