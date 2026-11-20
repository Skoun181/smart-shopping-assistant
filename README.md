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
| D – Stack-Manager | Grafische Bereitstellung ohne separate .env-Datei |

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

### D – Installation über einen Stack-Manager (Dockhand, Portainer usw.)

Für grafische Docker-Stack-Manager kann die Konfiguration direkt über **Environment variables** erfolgen. Die folgende Compose-Datei benötigt keine separate .env-Datei. Das Beispiel orientiert sich an einem Compose-Stack-Editor; Bezeichnungen können je nach Manager abweichen.

**1. Passwort-Hash lokal erzeugen**

Auf dem Docker-Host in einem interaktiven Terminal:

```bash
sudo docker run --rm -it --network none \
  --entrypoint node skoun181/smart-shopping-assistant:1.0.6 \
  scripts/hash-password.mjs
```

Ein Passwort mit mindestens 12 Zeichen wählen und sicher notieren. Der Generator gibt eine Zeile der Form `APP_PASSWORD_HASH='scrypt$32768$8$1$SALZ:DIGEST'` aus. SALZ und DIGEST sind Platzhalter, nicht ein verwendbarer Hash.

**2. Neuen Stack erstellen**

Stack-Namen wählen, z. B. `shopping`, und diese Compose-Datei in den Editor einfügen:

```yaml
services:
  shopping:
    image: docker.io/skoun181/smart-shopping-assistant:${SSA_IMAGE_TAG:-1.0.6}
    restart: unless-stopped
    init: true
    environment:
      APP_PASSWORD_HASH: "${APP_PASSWORD_HASH:?Password hash required}"
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

**3. Environment Variables hinterlegen**

| Name | Wert |
| --- | --- |
| APP_PASSWORD_HASH | Der vollständige zuvor generierte Hash, beginnend mit scrypt$ (Pflicht) |
| APP_PORT | 3000 oder ein eigener freier Host-Port (optional) |
| SSA_IMAGE_TAG | 1.0.6 oder ein anderer freigegebener Registry-Tag (optional) |

In einer Key/Value-Maske nur den Hash selbst einfügen, ohne `APP_PASSWORD_HASH=` und ohne die umgebenden einfachen Anführungszeichen. Der Hash muss unverändert mit allen Dollarzeichen, Doppelpunkt und Base64-Zeichen ankommen. Wenn der Manager stattdessen einen **rohen Compose-.env-Text** verlangt, die vollständige ausgegebene Zeile inklusive einfacher Anführungszeichen verwenden. Nicht den Klartext des Passworts in APP_PASSWORD_HASH eintragen. Keine echten Hashes, Passwörter oder Screenshots mit Secrets öffentlich teilen.

![Stack-Manager: Compose-Datei links und Environment Variables rechts, Passwort-Hash anonymisiert](https://raw.githubusercontent.com/Skoun181/smart-shopping-assistant/stable/smart-shopping-assistant/docs/screenshots/stack-manager.png)

*Beispiel aus einem Stack-Editor. Sensible Werte wurden im Screenshot vollständig verdeckt. Der interne Port bleibt 3000; ein zusätzlicher Test-Stack auf demselben Host benötigt einen anderen freien Host-Port.*

**4. Validieren, speichern und deployen**

**Validate** (falls vorhanden), anschließend **Create & Start** / **Deploy** auswählen. Container-Status und Logs prüfen; danach im Browser `http://SERVER-IP:3000` bzw. den gewählten Host-Port öffnen und mit dem gewählten Klartextpasswort anmelden.

Für Updates denselben Stack-Namen, Dienstnamen und dasselbe Volume behalten. Gewünschten SSA_IMAGE_TAG einstellen, neues Image pullen und den Stack neu deployen bzw. den Container neu erstellen. Bei Wechsel von einer bestehenden Installation das tatsächliche alte Volume zunächst überprüfen und explizit übernehmen, statt ein neues leeres Volume anzulegen. Einen Stack nicht gleichzeitig mit einem anderen Stack auf dasselbe SQLite-Datenvolume zugreifen lassen.

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

**Stack-Manager:** APP_PORT in Environment Variables auf 8080 (oder einen anderen freien Port) setzen, speichern und Stack neu deployen. Der interne PORT bleibt 3000. Bei bereits laufenden anderen Stacks müssen die Host-Ports unterschiedlich sein.

**Docker Run:** Port-Mappings eines bestehenden Containers lassen sich nicht nachträglich ändern. Container nach einem Backup stoppen und entfernen, dann mit demselben Run-Befehl und unverändertem Volume neu erstellen. Nur die Option `-p 0.0.0.0:8080:3000` anstelle von `-p 0.0.0.0:3000:3000` verwenden.

Neuer Browser-Zugriff: `http://SERVER-IP:8080`. Bei einem NGINX-Reverse-Proxy auch den Upstream-Port und gegebenenfalls die Firewall anpassen.

**Wichtig:** Ein veröffentlichter Docker-Port ist nicht als Internetfreigabe gedacht. Die Bindung 0.0.0.0 gilt für alle IPv4-Schnittstellen des Hosts. Zugriff per Docker-kompatibler Netzwerkfirewall auf vertrauenswürdige Geräte beschränken; keine Router-Portweiterleitung. Nur auf dem Host erreichbar: alternativ die Port-Zuordnung auf 127.0.0.1 begrenzen.

## Passwort ändern oder zurücksetzen

Das gemeinsame Passwort wird über APP_PASSWORD_HASH in der Container-Umgebung konfiguriert. Es ist kein Passwort-Reset per E-Mail nötig, und die vorhandenen Vorräte müssen nicht gelöscht werden.

1. Mit dem Generator aus der jeweiligen Installationsvariante einen neuen Hash erzeugen. Bei Verwendung des fertigen Images:

```bash
sudo docker run --rm -it --network none \
  --entrypoint node skoun181/smart-shopping-assistant:1.0.6 \
  scripts/hash-password.mjs
```

2. In der bestehenden Konfiguration nur APP_PASSWORD_HASH ersetzen:
   - Compose-Datei + .env: die gesamte generierte Zeile mit einfachen Anführungszeichen übernehmen. Nicht die übrige .env überschreiben.
   - Stack-Manager: rechts unter Environment Variables den Wert von APP_PASSWORD_HASH durch den neuen vollständigen Hash ersetzen. Bei einer Key/Value-Maske ohne die umgebenden Anführungszeichen; bei rohem Compose-.env-Text mit einfachen Anführungszeichen.
   - Docker Run: in .env.run den eigentlichen Hash ohne umgebende Anführungszeichen hinterlegen.
3. Container **neu erstellen**. Ein einfacher Restart übernimmt keine neuen Umgebungsvariablen.

Für Git Clone und Docker Compose:

```bash
sudo docker compose up -d --force-recreate
```

Bei einer abweichenden Compose-Datei wie compose.dockerhub.yaml denselben -f-Parameter wie bei der Installation verwenden. Im Stack-Manager Änderungen speichern und **Redeploy / Recreate** ausführen. Bei Docker Run den alten Container stoppen und entfernen, dann mit dem vollständigen Run-Befehl aus Variante C, gleicher .env.run, gleichem Port und gleichem Volume neu starten.

4. Danach im privaten Browserfenster mit dem neuen Klartextpasswort anmelden. Nach fünf fehlgeschlagenen Versuchen innerhalb des 15-Minuten-Fensters kann die Login-Sperre für 15 Minuten aktiv sein; weiteres Raten vermeiden. Der Passwortwechsel widerruft bereits bestehende Sitzungen nicht automatisch. Bestehende Geräte abmelden; serverseitige Sitzungen können bis zu 14 Tage gültig bleiben.

**Auch bei vergessenen Passwörtern bleiben die Daten erhalten.** Nur wenn wirklich ein kompletter Neustart ohne Daten gewünscht ist, kann nach ausdrücklicher Prüfung das zu genau dieser Installation gehörende Volume gelöscht werden. Ein neuer Stack mit anderem Namen erzeugt üblicherweise ein eigenes Volume. Andere Container und Volumes nicht löschen; niemals alle Docker-Volumes bereinigen, um ein Passwort zurückzusetzen.

## Häufige Fehler & Lösungen

| Fehler | Lösung |
| --- | --- |
| env file .../.env not found | Bei CLI-Compose die .env neben der Compose-Datei erstellen. Im Stack-Manager Variante D ohne env_file nutzen und APP_PASSWORD_HASH über Environment Variables setzen. |
| Password hash required / fehlender Hash | APP_PASSWORD_HASH unter dem exakten Variablennamen hinterlegen und den Stack neu deployen. |
| APP_PASSWORD_HASH is missing or malformed / Anmeldung trotz richtigem Passwort unmöglich | Prüfen, ob der komplette generierte Hash unverändert übergeben wurde. Dollarzeichen dürfen nicht interpoliert, abgeschnitten oder doppelt escaped werden. Bei Bedarf neuen Hash erzeugen. |
| HTTP 429 / Too many attempts | Login-Sperre abwarten (bis zu 15 Minuten ab Sperrbeginn). |
| Port is already allocated | Freien Host-Port wählen (z. B. 8080) und Container neu erstellen; interner Port bleibt 3000. |
| Anwendung zeigt keine bisherigen Vorräte | Compose-Projektnamen und eingebundenes Volume prüfen. Nicht vorschnell leere Volumes löschen oder alte Daten überschreiben. |

Bei Verdacht auf einen beschädigten Hash kann auf dem Host dessen **Format** kontrolliert werden, ohne den geheimen Wert auszugeben:

```bash
sudo docker ps --format '{{.Names}}'
sudo docker exec CONTAINERNAME node -e 'const p=(process.env.APP_PASSWORD_HASH||"").split("$");const q=(p[4]||"").split(":");console.log(p.length===5&&p[0]==="scrypt"&&p[1]==="32768"&&p[2]==="8"&&p[3]==="1"&&q.length===2&&Buffer.from(q[0],"base64").length===16&&Buffer.from(q[1],"base64").length===32?"Hash-Format OK":"Hash fehlt oder Format falsch")'
```

CONTAINERNAME durch den tatsächlichen Namen aus der ersten Ausgabe ersetzen. Ein korrektes Format beweist nicht, dass das eingegebene Passwort stimmt. Bei Problemen die Container-Logs prüfen, dabei niemals Secrets veröffentlichen.

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

**Stack-Manager (D):** Gewünschten SSA_IMAGE_TAG in Environment Variables einstellen, Image pullen und Stack neu deployen (Container neu erstellen). Stack-Name, Dienst und Volume beibehalten.

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

## Daten exportieren, importieren und Server wechseln (Develop)

Die kommende Version hat unter **Einstellungen → Daten sichern & umziehen** zwei neue Funktionen: **ZIP exportieren** und **Backup importieren**. Diese Änderungen sind **nur im Develop-Branch**; das bisherige Stable-Image 1.0.6 enthält sie noch nicht.

- **Enthalten:** Einkaufslisten, Vorräte, Produkte, eigene Kategorien, Varianten, Lagerorte und Import-/Buchungszuordnungen sowie Exportdatum, App- und Datenbank-Schema-Version und SHA-256-Prüfsumme.
- **Nicht enthalten:** Passwort/Hash, API-Schlüssel, Sitzungen, Loginversuche, .env, Docker-/Netzwerkkonfiguration und Browser-Einstellungen. Kassenbons und Bilder werden derzeit nicht dauerhaft gespeichert.
- **Sicherheit:** ZIP-Größe maximal 32 MiB, Prüfsummen- und Schema-Prüfung, Importwarnung, automatisches Sicherheits-Backup unter `/data/backups/` auf dem Zielsystem und transaktionale Wiederherstellung. Die ZIP selbst ist nicht verschlüsselt.

**Umzug in fünf einfachen Schritten:** 1. Auf dem alten Server ZIP herunterladen. 2. Auf dem neuen Server eine kompatible App-Installation und ein eigenes Passwort einrichten. 3. ZIP auswählen und prüfen. 4. Datenersetzung bestätigen. 5. Einkaufslisten und Vorräte prüfen, erst dann alten Server abschalten.

**[Ausführliche Schritt-für-Schritt-Anleitung einschließlich Docker Compose, Docker Run, Stack-Manager, SCP und Datenvolume](https://github.com/Skoun181/smart-shopping-assistant/blob/develop/smart-shopping-assistant-next/docs/backup-and-migration.md)**

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
- GitHub Actions prüft Typen, Tests, Build, Produktionsabhängigkeiten, Compose und APIs.
- Es gibt nur zwei dauerhafte Entwicklungsbranches. Neue Funktionen und Fehlerkorrekturen werden auf Develop vorbereitet, nicht in zusätzlichen Versionsbranches.
- Jeder freigegebene Anwendungsstand erhält eine neue Versionsnummer und einen unveränderlichen Release-Tag (z. B. v1.0.7). Der nächste Release wird erst nach ausdrücklicher Freigabe über einen Pull Request von Develop nach Stable übernommen.
- Dokumentations- und reine CI-Wartungsänderungen dürfen ohne neue Anwendungsversionsnummer erfolgen. Bestehende Release-Tags und feste Image-Tags werden dabei nicht verschoben oder neu veröffentlicht.
- Automatische Dependabot-Version-PRs sind deaktiviert, damit keine regelmäßigen zusätzlichen Branches entstehen. Sicherheitswarnungen und die CI-Sicherheitsprüfung bleiben wichtig; Abhängigkeiten auf Develop regelmäßig prüfen und aktualisieren. GitHub kann bei aktivierten automatischen Sicherheitsupdates weiterhin temporäre Dependabot-Branches anlegen.

### Einen neuen Stable-Release vorbereiten

1. Develop auf den aktuellen Stable-Stand bringen (Fast-Forward bzw. Merge, kein Force-Push).
2. Änderungen auf Develop entwickeln und testen.
3. Bei Freigabe eine neue höhere finale Version X.Y.Z in package.json und package-lock.json eintragen (z. B. `npm version 1.0.7 --no-git-tag-version`). Versionsanzeige, Health-API, Compose-Image-Tags, .env.example, README und RELEASE_NOTES.md ebenfalls anpassen. Keine Version doppelt verwenden.
4. Pull Request Develop → Stable erstellen, erfolgreiche CI abwarten und erst dann freigeben/mergen.
5. Der Workflow erstellt aus der Paketversion automatisch den GitHub-Release samt vX.Y.Z-Tag und veröffentlicht die geprüften Images auf Docker Hub und GHCR mit X.Y.Z sowie latest (nur für den neuesten Stable-Release).
6. Release und beide Registry-Uploads prüfen; danach Develop wieder mit Stable synchronisieren.

Ein bereits vorhandener Release-Tag bleibt unverändert. Die Workflows können für einen fehlgeschlagenen Upload manuell auf Stable erneut gestartet werden; die Images werden aus dem exakten Release-Tag gebaut und bestehende Versions-Tags nicht absichtlich überschrieben. Keine Beta-/RC-Version wird als Stable veröffentlicht.

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
