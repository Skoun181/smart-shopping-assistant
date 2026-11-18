# 🛒 Smart Shopping Assistant

**Dein Haushalt. Deine Einkaufsliste. Deine Daten.**

![Version](https://img.shields.io/badge/version-1.0.1-16a34a) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED) ![SQLite](https://img.shields.io/badge/database-SQLite-003b57)

Smart Shopping Assistant ist eine selbst gehostete, mobilfreundliche Web-App für gemeinsame Einkäufe und Vorräte. Die Anwendung läuft im eigenen Heimnetz, speichert Haushaltsdaten lokal in SQLite und benötigt für die Kernfunktionen keinen Cloud-Dienst.

**Version 1.0.1 Stable** · [Releases](../../releases) · [Automatische Prüfungen](../../actions)

## Funktionen

| Bereich | Funktionen |
| --- | --- |
| 🏠 Übersicht | Offene Einkäufe, erledigte Artikel und Vorräte auf einen Blick |
| 🛒 Einkaufsliste | Kategorien, Produkt-Emojis, Mehrfachauswahl per Kacheln, Freitext, Mengen und Varianten, Live-Aktualisierung |
| 📦 Vorräte | Einklappbare Kategorien, Plus/Minus-Verbrauch, genaue Mengen, eigene Einträge und kontrollierte Importe |
| 🗂️ Katalog | Über 300 kuratierte Alltagsprodukte, eigene Produkte, Suche, veränderbare und selbst erstellte Kategorien |
| 🧾 Kassenbon | Lokale Texterkennung für Fotos, PDFs und TXT, regelbasierter Katalogabgleich, bearbeitbare Vorschau |
| 📷 Foto-KI | Optionale lokale Ollama-Anbindung für Einkaufs- und Kühlschrankbilder |
| 📄 CSV | Vorlage und KI-Prompt für externe Auswertungen, bearbeitbare Importvorschau |
| 🎨 Oberfläche | Dark Mint und Dark Violet, Deutsch und Englisch, responsive Darstellung, PWA-Grundlagen |

## Screenshots & Bedienung

Die Übersicht zeigt offene Einkäufe. In der Einkaufsliste und bei den Vorräten lassen sich Kategorien einzeln öffnen und schließen. Die Vorratsansicht bietet direkte Mengensteuerung; der Importdialog führt von der Dateiauswahl über eine Vorschau bis zur ausdrücklichen Freigabe. Im Kategorien-Tab lassen sich Produktzuordnungen für den gesamten Haushalt ändern.

<!-- Screenshots: Originalbilder der Beta 0.3.2 können unter docs/screenshots/ ergänzt werden. Die geänderte Versionsanzeige in 1.0.0 ist die einzige sichtbare Release-Anpassung. -->

## Netzwerkzugriff – direkt oder über NGINX

Direkter Zugriff über `http://SERVER-IP:3000` und optional über NGINX auf demselben Port. Keine zusätzlichen Proxy-Ports, keine IP-Freigabeliste, kein Compose-Override und keine Änderungen an der `.env` nötig. Alte `ORIGIN`- und `BIND_ADDRESS`-Werte werden ignoriert. NGINX setzt `Host` und `X-Forwarded-Proto`. Der Server akzeptiert den Protokoll-Header ohne Proxy-Allowlist; ausschließlich im vertrauenswürdigen Heimnetz betreiben, keine Router-Freigabe. Details: [Netzwerk-Anleitung](docs/network-access.md) / [NGINX-Beispiel](deploy/nginx-remote.example.conf).

Beide Zugangswege können gleichzeitig verwendet werden. Beispiel: Shopping-VM `192.168.0.150:3000`, NGINX-VM `192.168.0.66`, lokaler DNS-Eintrag `list.xc.local` auf die NGINX-IP. Einzelne Sitzungen müssen beim Wechsel der Adresse neu angemeldet werden.

## Installation

### Voraussetzungen

- Linux-Server mit Docker Engine und Docker Compose Plugin; auf Proxmox vorzugsweise eine Debian-VM.
- Git und Zugriff auf dieses Repository (bei privatem Repository ist eine GitHub-Anmeldung erforderlich).
- Für den sicheren Zugriff von mehreren Geräten: vertrauenswürdiges HTTPS im Heimnetz; alternativ für Tests ein SSH-Tunnel.

### 1. Release herunterladen

```bash
git clone https://github.com/Skoun181/smart-shopping-assistant.git
cd smart-shopping-assistant
git checkout v1.0.1
cp .env.example .env
chmod 600 .env
```

### 2. Gemeinsames Passwort konfigurieren

```bash
sudo docker run --rm -it --network none \
  -v "$PWD/scripts:/work:ro" -w /work \
  node:24-alpine node hash-password.mjs
```

Das Passwort wird unsichtbar abgefragt. Die ausgegebene Zeile `APP_PASSWORD_HASH='scrypt$...'` vollständig in `.env` übernehmen. Die einfachen Anführungszeichen sind wichtig, damit Docker Compose die Dollarzeichen nicht interpoliert. Keine echten Zugangsdaten in GitHub speichern.

Für den ersten lokalen Test:

```dotenv
APP_PORT=3000
```

Die App lauscht standardmäßig auf allen IPv4-Schnittstellen der VM und verwendet die im Browser aufgerufene Adresse automatisch. Port 3000 per Proxmox-/Netzwerkfirewall auf vertrauenswürdige Geräte beschränken. HTTPS bei Bedarf über NGINX einrichten. Keine Router-Portfreigabe; HTTP ist unverschlüsselt.

### 3. Starten

```bash
sudo docker compose config --quiet
sudo docker compose up -d --build
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Die Health-API meldet `1.0.1`. Im Heimnetz direkt `http://SERVER-IP:3000` öffnen. Alternativ vom PC über einen SSH-Tunnel zugreifen:

```bash
ssh -N -L 3000:127.0.0.1:3000 BENUTZER@SERVER-IP
```

Anschließend auf dem PC `http://localhost:3000` öffnen und mit dem gemeinsamen Passwort anmelden.

## Vorräte importieren

Unter **Vorräte → Scannen & importieren** einen Kassenbon, ein Foto oder CSV auswählen. Die App erstellt einen Entwurf. Namen, Mengen, Einheiten, Varianten und Kategorien kontrollieren, nicht gewünschte Zeilen abwählen und den Import ausdrücklich bestätigen. Der Import ergänzt den Bestand und ersetzt ihn nicht. Erneut gescannte Bons können Duplikate verursachen.

- **Kassenbon:** JPG, PNG, PDF oder TXT bis 5 MiB; PDFs bis drei Seiten. Tesseract und Poppler verarbeiten die Dateien lokal. Abkürzungen werden anhand von Regeln und Katalogeinträgen interpretiert. Unklare Mengen und Produktzuordnungen kontrollieren.
- **Kühlschrank / Einkauf:** JPG oder PNG; benötigt einen separat eingerichteten lokalen Ollama-Dienst mit bildfähigem Modell. Ohne diesen Dienst ist der Foto-KI-Modus deaktiviert.
- **KI / CSV:** CSV-Vorlage und Prompt stehen in der App bereit. Externe KI-Auswertungen werden nur auf eigene Initiative verwendet. Persönliche Kunden- und Zahlungsdaten vorher entfernen.

### CSV-Beispiel

```csv
produkt;menge;einheit;kategorie;variante
H-Milch;2;l;Milchprodukte & Eier;
Äpfel;5;pcs;Obst & Gemüse;
Binden;1;pack;Körperpflege;
```

UTF-8, maximal 100 KB und 200 Produktzeilen. Unterstützte Einheiten: `pcs`, `pack`, `g`, `kg`, `ml`, `l`. Unbekannte Mengen leer lassen und in der Vorschau ergänzen. Dezimalpunkt oder Dezimalkomma möglich; bei Komma als CSV-Trennzeichen müssen Dezimalkommas in Anführungszeichen stehen.

### Optionale lokale Bild-KI

Auf einem separaten Heimnetz-Rechner Ollama mit einem bildfähigen, lokal installierten Modell betreiben. Cloud-Funktionen deaktivieren (`OLLAMA_NO_CLOUD=1`); Port 11434 per Firewall ausschließlich für die Shopping-VM freigeben. In `.env` die tatsächliche private IPv4-Adresse und den installierten Modellnamen setzen:

```dotenv
PANTRY_VISION_URL=http://192.168.178.60:11434/
PANTRY_VISION_MODEL=DEIN_LOKALES_BILDMODELL
```

`sudo docker compose up -d --force-recreate` lädt die Konfiguration. Ohne diese optionale Einrichtung funktionieren Kassenbon-OCR und CSV weiterhin.

## Update auf Version 1.0.1

Im bestehenden Projektordner zunächst ein Backup erstellen; keine Neuinstallation oder Volume-Löschung erforderlich:

```bash
sudo docker compose exec shopping node scripts/backup.mjs /data/backups/pre-v101.db
sudo docker cp "$(sudo docker compose ps -q shopping)":/data/backups/pre-v101.db "$HOME/pre-v101.db"
sudo chown "$USER:$USER" "$HOME/pre-v101.db"
chmod 600 "$HOME/pre-v101.db"
git status --short
git fetch origin --tags
git checkout v1.0.1
sudo docker compose up -d --build
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Falls ein Compose-Override aus einem früheren 1.0.1-Teststand Port 3001 veröffentlicht, diese alte Konfiguration entfernen; andere lokale Einstellungen beibehalten. Bestehende ORIGIN/BIND_ADDRESS-Werte müssen nicht geändert werden. Vor dem Checkout lokale Änderungen prüfen und das Backup zusätzlich außerhalb der VM sichern. `.env`, das gemeinsame Passwort und das bestehende Datenvolume bleiben erhalten. **Niemals `docker compose down -v` für ein gewöhnliches Update ausführen.**

## Sicherheit & Datenschutz

- Gemeinsames Passwort als Scrypt-Hash, serverseitige Sitzungen, HTTP-only-Cookies und Login-Rate-Limit.
- Origin-Prüfung bei Schreibzugriffen, Zod-Eingabevalidierung und parametrisierte SQL-Anfragen.
- Container ohne Root, schreibgeschütztes Root-Dateisystem, reduzierte Linux-Capabilities.
- SQLite-Datenbank lokal; Importdateien werden nur temporär verarbeitet. Keine automatischen Cloud-KI-Aufrufe.
- Bestätigte Importe werden transaktional gespeichert; Versionsprüfungen schützen Vorratsänderungen vor veralteten Ansichten.
- npm-Lockfile und `npm ci` für reproduzierbare Paketinstallationen; Dependabot und automatisierte Sicherheitsprüfungen.

Für den sicheren Dauerbetrieb HTTPS, regelmäßige System- und Paketupdates und eine auf das Heimnetz begrenzte Firewall einsetzen. Ein erfolgreicher Audit ersetzt keine unabhängige Sicherheitsprüfung. Für vertrauliche Bons kein unverschlüsseltes HTTP verwenden.

## Backup & Wartung

Die SQLite-Datenbank liegt im Docker-Volume `shopping_data` unter `/data/shopping.db`. Ein konsistentes Backup kann bei laufender Anwendung erzeugt werden:

```bash
sudo docker compose exec shopping node scripts/backup.mjs /data/backups/backup.db
sudo docker cp "$(sudo docker compose ps -q shopping)":/data/backups/backup.db "$HOME/backup.db"
sudo chown "$USER:$USER" "$HOME/backup.db"
chmod 600 "$HOME/backup.db"
```

Backup zusätzlich auf einem anderen Gerät sichern. Für eine Wiederherstellung die App stoppen, den bisherigen Datenbankstand einschließlich möglicher WAL-/SHM-Dateien sichern, eine konsistente Backup-Kopie mit korrekten Dateirechten als `shopping.db` wiederherstellen und anschließend starten. Restore zuerst auf einer Testinstanz erproben.

## Technischer Aufbau

SvelteKit / Svelte / TypeScript · Node.js 24 · SQLite / better-sqlite3 · REST API · Server-Sent Events · Docker Compose · Tesseract / Poppler · Vitest / GitHub Actions.

```text
Browser / PWA
     │
     ▼
SvelteKit (Node.js) ── REST / SSE
     ├── SQLite (persistentes Volume)
     ├── lokale OCR / PDF-Auswertung
     └── optionale lokale Ollama-Anbindung
```

## Grenzen und Ausblick

Version 1.0.1 ist ein stabiler Funktionsstand für den privaten Heimnetz-Einsatz. Die automatische Bon-Erkennung ist heuristisch und kann Fehler machen. Die Bild-KI ist optional und hängt von Modell und Hardware ab. Keine vollständige Offline-Bearbeitung; die PWA-Kompatibilität ist browserabhängig. Rezeptvorschläge, Supermarktangebote und selbstlernende Bon-Zuordnungen sind noch nicht Bestandteil dieses Releases. Browser-, Backup-/Restore- und reale KI-Tests bleiben bei der eigenen Installation wichtig.

## Entwicklung

```bash
npm ci
npm run check
npm test
npm run build
```

Änderungen über Feature-Branches und Pull Requests einreichen. GitHub Actions prüft Typen, Tests, Build, Produktionsabhängigkeiten, Docker und API-Smoke-Tests.

## Lizenz

Privates Projekt. Eine öffentliche Open-Source-Lizenz wurde bislang nicht festgelegt.

---

Mit Fokus auf Selbsthosting, Datenschutz und einen unkomplizierten Einkaufsalltag.
