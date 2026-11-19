# 🛒 Smart Shopping Assistant

**Dein Haushalt. Deine Einkaufsliste. Deine Daten.**

![Stable](https://img.shields.io/badge/stable-1.0.6-16a34a) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED) ![SQLite](https://img.shields.io/badge/database-SQLite-003b57)

Eine selbst gehostete, mobilfreundliche Web-App für gemeinsame Einkäufe und Vorräte. Alle Haushaltsdaten bleiben in der lokalen SQLite-Datenbank. Für die Kernfunktionen werden keine Cloud-Dienste benötigt.

**Aktuelle Stable-Version: 1.0.6**

[GitHub](https://github.com/Skoun181/smart-shopping-assistant) · [Releases](https://github.com/Skoun181/smart-shopping-assistant/releases) · [Docker Hub](https://hub.docker.com/r/skoun181/smart-shopping-assistant/tags) · [GitHub Container Registry](https://github.com/Skoun181/smart-shopping-assistant/pkgs/container/smart-shopping-assistant)

## Funktionen

- Gemeinsame Einkaufsliste mit Kategorien, Produkt-Emojis, Mehrfachauswahl, Freitext und Plus-/Minus-Mengensteuerung.
- Vorräte mit einklappbaren Kategorien, genauen Mengen und direktem Verbrauch ohne Bestätigungsdialog.
- Automatische Vorratsbuchung beim Abhaken. Enthaken eröffnet einen neuen Einkaufsbedarf, ohne Vorräte abzuziehen.
- Über 300 kuratierte Alltagsprodukte, eigene Produkte, Varianten und Kategorien.
- Live-Synchronisierung zwischen Geräten, Deutsch/Englisch, Dark Mint/Dark Violet und PWA-Grundlagen.
- Lokale Kassenbon-Erkennung (OCR), PDF/TXT, CSV-Import und optionale lokale Ollama-Bild-KI.

## Installation

### Voraussetzungen

- Linux-Server oder Debian-VM auf Proxmox; fertige Images unterstützen Linux AMD64 (x86-64).
- Docker Engine und für die Compose-Varianten das Docker Compose Plugin: [offizielle Docker-Installationsanleitung](https://docs.docker.com/engine/install/).
- Git nur für Variante A; curl und ein Texteditor für die folgenden Beispiele.
- Ein freier Host-Port (Standard: 3000).

```bash
docker --version
docker compose version
```

**Nur eine der folgenden Varianten installieren.** Alle verwenden dieselbe Anwendung und ein persistentes Datenvolume. Die Beispiele setzen Docker-Zugriff über sudo voraus; bei einer entsprechend eingerichteten Docker-Umgebung kann sudo entfallen.

| Variante | Empfehlung |
| --- | --- |
| A – Git Clone | Quellcode selbst bauen |
| B – Docker Compose | Empfohlen: fertiges Docker-Hub-Image, ohne Git-Clone |
| C – Docker Pull / Run | Ohne Compose, manuelle Container-Verwaltung |

### A – Installation über Git Clone

Quellcode der festen Stable-Version herunterladen:

```bash
mkdir -p ~/apps
cd ~/apps
git clone --branch v1.0.6 https://github.com/Skoun181/smart-shopping-assistant.git
cd smart-shopping-assistant
umask 077
cp .env.example .env
chmod 600 .env
```

Falls der Projektordner bereits vorhanden ist, stattdessen die Update-Anleitung verwenden. Gemeinsames Passwort (mindestens 12 Zeichen) lokal generieren:

```bash
sudo docker run --rm -it --network none \
  -v "$PWD/scripts:/work:ro" -w /work \
  node:24-alpine node hash-password.mjs
nano .env
```

Die ausgegebene komplette Zeile `APP_PASSWORD_HASH='scrypt$...'` ersetzt den Platzhalter in der .env. Einfache Anführungszeichen beibehalten. Optional `APP_PORT=3000` anpassen.

```bash
sudo docker compose config --quiet
sudo docker compose up -d --build
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

### B – Installation über Docker Compose (empfohlen)

Kein Git-Clone, kein Node.js und kein lokaler Image-Build nötig.

```bash
mkdir -p ~/apps/smart-shopping-assistant
cd ~/apps/smart-shopping-assistant
```

Datei `compose.yaml` erstellen:

```yaml
services:
  shopping:
    image: docker.io/skoun181/smart-shopping-assistant:${SSA_IMAGE_TAG:-1.0.6}
    restart: unless-stopped
    init: true
    env_file:
      - .env
    environment:
      DATABASE_PATH: /data/shopping.db
      HOST: 0.0.0.0
      PORT: 3000
    ports:
      - "0.0.0.0:${APP_PORT:-3000}:3000"
    volumes:
      - shopping_data:/data
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp:rw,nosuid,noexec,size=64m
volumes:
  shopping_data:
```

Das Image enthält bereits einen Healthcheck. Alternativ statt manueller Erstellung die [fertige Compose-Datei](https://github.com/Skoun181/smart-shopping-assistant/blob/stable/smart-shopping-assistant/compose.dockerhub.yaml) herunterladen (nur bei Neuinstallation unter diesem Namen speichern):

```bash
curl -fsSL https://raw.githubusercontent.com/Skoun181/smart-shopping-assistant/stable/smart-shopping-assistant/compose.dockerhub.yaml -o compose.yaml
```

Image herunterladen und Passwort generieren:

```bash
sudo docker pull skoun181/smart-shopping-assistant:1.0.6
sudo docker run --rm -it --network none --entrypoint node \
  skoun181/smart-shopping-assistant:1.0.6 scripts/hash-password.mjs
umask 077
nano .env
```

Inhalt der .env (Platzhalter durch die tatsächlich ausgegebene Hash-Zeile ersetzen):

```dotenv
APP_PASSWORD_HASH='DEIN_GENERIERTER_SCRYPT_HASH'
APP_PORT=3000
SSA_IMAGE_TAG=1.0.6
```

Die einfachen Anführungszeichen um den Hash beibehalten, damit Compose die Dollarzeichen nicht interpoliert. Das gewählte Klartextpasswort wird nur zur Anmeldung verwendet.

```bash
chmod 600 .env
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

**Alternative GHCR:** Im Compose-Beispiel nur die Image-Adresse durch `ghcr.io/skoun181/smart-shopping-assistant:${SSA_IMAGE_TAG:-1.0.6}` ersetzen und dieselbe GHCR-Adresse auch bei docker pull und beim Passwort-Generator verwenden. Das Paket muss öffentlich sein oder ein Registry-Login ist nötig.

### C – Installation über Docker Pull und Docker Run (ohne Compose)

Ein separates Beispiel mit manuell verwaltetem Container und eigenem persistentem Volume.

```bash
mkdir -p ~/apps/smart-shopping-assistant-run
cd ~/apps/smart-shopping-assistant-run
sudo docker pull skoun181/smart-shopping-assistant:1.0.6
sudo docker run --rm -it --network none --entrypoint node \
  skoun181/smart-shopping-assistant:1.0.6 scripts/hash-password.mjs
umask 077
nano .env.run
```

In .env.run den ausgegebenen Hash eintragen, diesmal **ohne** die umgebenden einfachen Anführungszeichen. Docker Run verarbeitet env-files anders als Compose; die Dollarzeichen bleiben wörtlich erhalten.

```dotenv
APP_PASSWORD_HASH=DEIN_GENERIERTER_SCRYPT_HASH
```

```bash
chmod 600 .env.run
sudo docker volume create ssa_run_data
sudo docker run -d \
  --name smart-shopping-assistant \
  --restart unless-stopped --init \
  --env-file .env.run \
  -p 0.0.0.0:3000:3000 \
  -v ssa_run_data:/data \
  --security-opt no-new-privileges:true \
  --cap-drop ALL --read-only \
  --tmpfs /tmp:rw,nosuid,noexec,size=64m \
  skoun181/smart-shopping-assistant:1.0.6

sudo docker ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

### Erste Anmeldung

Im Browser `http://SERVER-IP:3000` öffnen und mit dem zuvor gewählten Passwort anmelden. Bei einem anderen Host-Port die URL und den Healthcheck entsprechend anpassen. Erwartete Health-Antwort:

```json
{"ok":true,"version":"1.0.6"}
```

## Host-Port ändern

Der interne Container-Port bleibt immer **3000**. Nur der von Docker am Host veröffentlichte Port wird geändert. Beispiel: Host-Port **8080**.

**Docker Compose:** In .env ändern:

```dotenv
APP_PORT=8080
```

```bash
sudo docker compose up -d
curl -fsS http://127.0.0.1:8080/api/v1/health
```

Bei einer abweichenden Compose-Datei immer denselben `-f DATEINAME`-Parameter verwenden.

**Docker Run:** Port-Mappings eines bestehenden Containers lassen sich nicht nachträglich ändern. Container nach einem Backup stoppen und entfernen, dann mit demselben Run-Befehl und unverändertem Volume neu erstellen. Nur die Option `-p 0.0.0.0:8080:3000` anstelle von `-p 0.0.0.0:3000:3000` verwenden.

Neuer Browser-Zugriff: `http://SERVER-IP:8080`. Bei einem NGINX-Reverse-Proxy auch den Upstream-Port und gegebenenfalls die Firewall anpassen.

**Wichtig:** Ein veröffentlichter Docker-Port ist nicht als Internetfreigabe gedacht. Die Bindung 0.0.0.0 gilt für alle IPv4-Schnittstellen des Hosts. Zugriff per Docker-kompatibler Netzwerkfirewall auf vertrauenswürdige Geräte beschränken; keine Router-Portweiterleitung. Nur auf dem Host erreichbar: alternativ die Port-Zuordnung auf 127.0.0.1 begrenzen.

## Updates

Vor jedem Update ein externes Datenbank-Backup erstellen (siehe unten). Projektordner, Volume und Passwort beibehalten.

**Git Clone (A):**

```bash
git status --short
git fetch origin --tags
git checkout v1.0.6
sudo docker compose up -d --build
```

Für spätere Updates v1.0.6 durch den gewünschten veröffentlichten Release-Tag ersetzen. Lokale Änderungen zuerst sichern.

**Docker Compose (B):** In .env den gewünschten festen `SSA_IMAGE_TAG` einstellen, dann:

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
```

`SSA_IMAGE_TAG=latest` folgt dem zuletzt publizierten Stable-Image beim nächsten Pull; feste Versionen sind besser reproduzierbar.

**Docker Run (C):** Neues Image zuerst pullen, Backup erstellen, dann:

```bash
sudo docker stop smart-shopping-assistant
sudo docker rm smart-shopping-assistant
```

Den vollständigen Run-Befehl aus Variante C mit dem neuen Image-Tag, derselben .env.run, demselben Port und demselben Volume erneut ausführen.

**Niemals `docker compose down -v` oder das Datenvolume löschen**, wenn die Haushaltsdaten erhalten bleiben sollen.

### Bestehende Git-Installation auf Docker Hub umstellen

Im bisherigen Projektordner (nicht in einem neuen Ordner) zuerst Datenbank und .env sichern. Compose-Projektname, Dienstname `shopping` und Volume `shopping_data` unverändert beibehalten; bei früherem `-p` bzw. COMPOSE_PROJECT_NAME denselben Wert verwenden.

```bash
cd ~/apps/smart-shopping-assistant
curl -fsSL https://raw.githubusercontent.com/Skoun181/smart-shopping-assistant/stable/smart-shopping-assistant/compose.dockerhub.yaml -o compose.dockerhub.yaml
sudo docker compose -f compose.dockerhub.yaml pull
sudo docker compose -f compose.dockerhub.yaml up -d
sudo docker compose -f compose.dockerhub.yaml ps
```

Ab dann für Updates und Verwaltung stets diese Compose-Datei verwenden. Kein neuer Passwort-Hash nötig. Das bestehende Volume muss vor dem Wechsel mit dem bisherigen Compose-Projektnamen überprüft werden. Nur falls bisher abweichende lokale Compose-Overrides notwendig waren, deren Einstellungen bewusst übernehmen.

## Backup & Wartung

Die SQLite-Datenbank liegt im Container unter `/data/shopping.db`. Bei Compose:

```bash
sudo docker compose exec shopping node scripts/backup.mjs /data/backups/backup.db
sudo docker cp "$(sudo docker compose ps -q shopping)":/data/backups/backup.db "$HOME/ssa-backup.db"
sudo chown "$(id -u):$(id -g)" "$HOME/ssa-backup.db"
chmod 600 "$HOME/ssa-backup.db"
```

Bei Docker Run die ersten beiden Befehle durch folgende ersetzen:

```bash
sudo docker exec smart-shopping-assistant node scripts/backup.mjs /data/backups/backup.db
sudo docker cp smart-shopping-assistant:/data/backups/backup.db "$HOME/ssa-backup.db"
```

Besitz und Rechte wie oben setzen. Backup sowie .env bzw. .env.run getrennt und geschützt außerhalb der VM sichern. Für Restore die App stoppen, bisherigen DB-Stand inklusive WAL/SHM sichern und eine konsistente Backup-Kopie mit korrekten Dateirechten wiederherstellen. Restore zuerst auf einer Testinstanz erproben.

## Netzwerk & Sicherheit

- Direkter LAN-Zugriff und NGINX-Reverse-Proxy funktionieren gleichzeitig über den Host-Port. NGINX muss Host und X-Forwarded-Proto korrekt setzen; SSE-Buffering deaktivieren, Upload-Limit 6 MiB. [Netzwerk-Anleitung](https://github.com/Skoun181/smart-shopping-assistant/blob/stable/smart-shopping-assistant/docs/network-access.md).
- HTTP ist unverschlüsselt. Für vertrauliche Daten HTTPS im privaten Netz nutzen; das vereinfachte Proxy-Modell vertraut X-Forwarded-Proto ohne Proxy-IP-Allowlist. Nicht direkt im Internet betreiben.
- Scrypt-Passwort-Hash, serverseitige Sitzungen, HttpOnly-Cookies, Login-Limits, Origin-Prüfung, Eingabevalidierung und parametrisierte SQL-Anfragen.
- Container ohne Root, schreibgeschütztes Root-Dateisystem, reduzierte Capabilities. Haushaltsdaten liegen lokal, nicht in der Registry. Passwort, Hash, Datenbank und private Bons niemals committen.
- Ein erfolgreicher automatischer Audit ersetzt keine unabhängige Sicherheitsprüfung.

## Vorräte importieren

Unter **Vorräte → Scannen & importieren** einen Bon, ein Foto oder CSV auswählen. Vorschau prüfen und Import ausdrücklich bestätigen. Der Import ergänzt den Bestand.

- Bons: JPG, PNG, PDF oder TXT bis 5 MiB, PDF maximal drei Seiten; lokale OCR mit Tesseract und Poppler.
- Fotos von Einkäufen/Kühlschrank: optional lokaler Ollama-Dienst mit bildfähigem Modell; ohne Dienst deaktiviert.
- CSV: UTF-8, maximal 100 KB/200 Produktzeilen. Einheiten pcs, pack, g, kg, ml, l. Dezimalpunkt oder Dezimalkomma möglich.

```csv
produkt;menge;einheit;kategorie;variante
H-Milch;2;l;Milchprodukte & Eier;
Äpfel;5;pcs;Obst & Gemüse;
```

Optionale lokale Bild-KI: PANTRY_VISION_URL (private IPv4-Adresse und Port 11434) sowie PANTRY_VISION_MODEL in der lokalen Umgebung setzen. Ollama ohne Cloud-Funktionen betreiben und Zugriff per Firewall beschränken. Compose-Container danach neu erstellen.

**Keine Doppelbuchung:** Bereits abgehakte Einkäufe nicht zusätzlich vollständig per Kassenbon importieren. Bereits vor Einführung der automatischen Vorratsbuchung abgehakte Artikel werden nicht rückwirkend eingebucht. OCR und KI-Vorschläge sind nicht fehlerfrei; Mengen kontrollieren.

## Entwicklung & Veröffentlichung

SvelteKit, Svelte, TypeScript, Node.js 24, better-sqlite3, REST, SSE, Docker Compose, Tesseract/Poppler und Vitest.

- `stable/smart-shopping-assistant`: freigegebene Versionen.
- `develop/smart-shopping-assistant-next`: laufende Entwicklung.
- GitHub Actions prüft Typen, Tests, Build, Produktionsabhängigkeiten, Compose und APIs. Docker Hub und GHCR werden aus freigegebenen Release-Tags veröffentlicht; keine Develop-Images als Stable.

```bash
npm ci
npm run check
npm test
npm run build
```

Für Docker-Hub-Veröffentlichungen ist das Repository-Secret DOCKERHUB_TOKEN mit Read/Write-Rechten erforderlich. Nur Maintainer benötigen diesen Token, normale Nutzer nicht. Der manuelle Publish-Workflow kann einen vorhandenen Stable-Release erneut veröffentlichen.

## Grenzen und Lizenz

Keine vollständige Offline-Bearbeitung; PWA-Funktionen sind browserabhängig. KI-Modelle und Hardware beeinflussen Bilderkennung. Rezepte, Supermarktangebote und selbstlernende Bon-Zuordnungen sind nicht enthalten.

Der Quellcode ist öffentlich einsehbar; eine öffentliche Open-Source-Lizenz wurde bisher nicht festgelegt.

---

Mit Fokus auf Selbsthosting, Datenschutz und einen unkomplizierten Einkaufsalltag.
