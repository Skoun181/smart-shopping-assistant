# 🛒 Smart Shopping Assistant

**Dein Haushalt. Deine Einkaufsliste. Deine Daten.**

![Stable](https://img.shields.io/badge/stable-1.0.7-16a34a) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED) ![SQLite](https://img.shields.io/badge/database-SQLite-003b57)

Eine selbst gehostete, mobilfreundliche Web-App für gemeinsame Einkäufe und Vorräte. Haushaltsdaten bleiben in der lokalen SQLite-Datenbank. Keine Cloud für die Kernfunktionen.

**Version 1.0.7:** Keine .env-Datei, keine manuelle Passwort-Hash-Erzeugung und kein Benutzername mehr nötig. Beim ersten Start erscheint **Create Login**. Der gemeinsame Passwort-Hash bleibt in der persistenten Datenbank. Außerdem stehen portable ZIP-Sicherungen und die Wiederherstellung über die Weboberfläche zur Verfügung.

[GitHub](https://github.com/Skoun181/smart-shopping-assistant) · [Releases](https://github.com/Skoun181/smart-shopping-assistant/releases) · [Docker Hub](https://hub.docker.com/r/skoun181/smart-shopping-assistant/tags)

## Funktionen

- Gemeinsame Einkaufsliste mit Kategorien, Emojis, Mehrfachauswahl, Freitext und Plus-/Minus-Mengensteuerung.
- Vorräte mit einklappbaren Kategorien, genauen Mengen und direktem Verbrauch.
- Automatische Vorratsbuchung beim Abhaken. Enthaken eröffnet neuen Einkaufsbedarf, ohne Vorräte abzuziehen.
- Über 300 kuratierte Produkte, eigene Produkte, Varianten und Kategorien.
- Live-Synchronisierung, Deutsch/Englisch, Dark Mint/Dark Violet und PWA-Grundlagen.
- Lokale Kassenbon-Erkennung (OCR), PDF/TXT, CSV und optionale lokale Ollama-Bild-KI.
- ZIP-Export und Wiederherstellung mit Vorschau, automatischem Sicherheits-Backup und SQLite-Transaktion.

## Installation

Voraussetzungen: Docker Engine, bei Compose das Compose-v2-Plugin, Linux AMD64/x86-64 (fertige Images), ein freier Port. Nur **eine** der Installationsvarianten wählen. Die App ist für private, vertrauenswürdige Netze gedacht. Vor allem beim ersten Start und Passwort-Reset den Zugriff auf den Einrichtenden begrenzen (Firewall/isoliertes Netz); sonst kann der erste erreichende Client das gemeinsame Passwort festlegen. HTTPS oder VPN nutzen, keine öffentliche Portfreigabe.

### A – Docker Compose (empfohlen)

```bash
mkdir -p ~/apps/smart-shopping-assistant
cd ~/apps/smart-shopping-assistant
curl -fsSL https://raw.githubusercontent.com/Skoun181/smart-shopping-assistant/v1.0.7/compose.dockerhub.yaml -o compose.yaml
```

Alternativ `compose.yaml` mit folgendem Inhalt selbst erstellen:

```yaml
services:
  shopping:
    image: docker.io/skoun181/smart-shopping-assistant:1.0.7
    restart: unless-stopped
    init: true
    ports:
      - "3000:3000"
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

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
```

Bei GHCR stattdessen `ghcr.io/skoun181/smart-shopping-assistant:1.0.7` verwenden.

### B – Docker Pull und Docker Run

```bash
sudo docker pull skoun181/smart-shopping-assistant:1.0.7
sudo docker volume create ssa_run_data
sudo docker run -d \
  --name smart-shopping-assistant \
  --restart unless-stopped --init \
  -p 3000:3000 \
  -v ssa_run_data:/data \
  --security-opt no-new-privileges:true --cap-drop ALL \
  --read-only --tmpfs /tmp:rw,nosuid,noexec,size=64m \
  skoun181/smart-shopping-assistant:1.0.7
```

### C – Git Clone und lokaler Build

```bash
mkdir -p ~/apps
cd ~/apps
git clone --branch v1.0.7 https://github.com/Skoun181/smart-shopping-assistant.git
cd smart-shopping-assistant
sudo docker compose up -d --build
sudo docker compose ps
```

Keine .env erstellen. Für Updates eine vorhandene Installation nicht erneut klonen.

### D – Dockhand / Portainer / Synology

Neuen normalen Compose-Stack erstellen. Variante A mit benanntem Volume funktioniert auch in einem Stack-Manager. Für Synology mit festem Verzeichnis verwende:

```yaml
services:
  shopping:
    image: docker.io/skoun181/smart-shopping-assistant:1.0.7
    container_name: shopping
    restart: unless-stopped
    init: true
    ports:
      - "4445:3000"
    volumes:
      - /volume2/docker/shopping:/data
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp:rw,nosuid,noexec,size=64m
```

1. Datenordner anlegen, falls er noch nicht existiert: `sudo mkdir -p /volume2/docker/shopping`.
2. Der nichtprivilegierte Container-Benutzer muss dort schreiben können. Seine UID/GID ermitteln: `sudo docker run --rm --entrypoint id skoun181/smart-shopping-assistant:1.0.7`. Bei einem neuen leeren Ordner entsprechende Eigentümer/Rechte bzw. DSM-ACL setzen; bestehende Daten nicht unüberlegt rekursiv umberechtigen.
3. Compose einfügen. Keine Environment Variables erforderlich. Bei bestehenden Stacks den bisherigen Datenpfad und Projektnamen beibehalten.
4. Validate und Deploy/Redeploy. Die App ist unter `http://SYNOLOGY-IP:4445` erreichbar.

[Synology-Compose-Vorlage](https://github.com/Skoun181/smart-shopping-assistant/blob/v1.0.7/compose.synology.yaml)

### E – Develop separat testen

```bash
git clone --branch develop/smart-shopping-assistant-next https://github.com/Skoun181/smart-shopping-assistant.git
cd smart-shopping-assistant
sudo docker compose -f compose.develop.yaml pull
sudo docker compose -f compose.develop.yaml up -d
```

GHCR-Tag `develop`, Host-Port 3008, separates Volume. Diese Vorschau nie mit Produktionsdaten betreiben.

### Erste Anmeldung: Create Login

1. Im Browser `http://SERVER-IP:3000` öffnen (Synology-Beispiel: Port 4445).
2. **Create Login** erscheint bei einer neuen Datenbank.
3. Ein gemeinsames Passwort mit mindestens zwölf Zeichen eingeben und wiederholen (maximal 1024 UTF-8-Bytes).
4. Passwort erstellen. Danach gelangst du zur Anwendung.
5. Künftige Anmeldungen benötigen nur dieses Passwort, keinen Benutzernamen.

Der Salt/Hash (scrypt) wird in SQLite gespeichert, nicht das Klartextpasswort. Ohne das Datenvolume wird auch die Login-Konfiguration nicht erhalten. Die Einrichtung wird nach dem ersten erfolgreichen Anlegen serverseitig gesperrt.

## Port und Version ändern

Direkt im Compose-Stack, z. B.:

```yaml
image: docker.io/skoun181/smart-shopping-assistant:1.0.7
ports:
  - "8080:3000"
```

Nur den **linken Host-Port** ändern, der Containerport bleibt 3000. Danach `docker compose up -d`. Bei Docker Run wird der Container nach Sicherung der Daten mit demselben Volume und neuem `-p 8080:3000` neu erstellt. Für einen nur lokalen Zugriff beispielsweise `127.0.0.1:3000:3000` und SSH-Tunnel verwenden.

## Update von 1.0.6 (oder älter)

**Vorher** eine konsistente vollständige Datenbanksicherung anlegen, extern speichern und auch die alte Konfiguration geschützt aufbewahren. Datenvolume, Bind Mount und Compose-Projektname unverändert lassen.

- Wenn das bisherige Passwort funktioniert: zunächst nur den Image-Tag auf 1.0.7 ändern und das alte `APP_PASSWORD_HASH` einmalig beibehalten. Container neu erstellen, App öffnen und mit dem bisherigen Passwort anmelden. Der gültige alte Hash wird einmalig gespeichert; alte Sitzungen werden widerrufen.
- Danach `APP_PASSWORD_HASH`, `env_file` und sonstige Passwort-Variablen entfernen. Image-Tag und Host-Port direkt in Compose eintragen, erneut deployen. Das gespeicherte Passwort bleibt erhalten.
- Wenn der bisherige Hash beschädigt/fehlend ist: direkt mit der neuen Compose-Datei ohne ENV starten. Eine bereits bestehende Datenbank zeigt ggf. **Login-Einrichtung gesperrt**. Der Host-Besitzer kann die Einrichtung mit dem folgenden lokalen Reset freigeben. Keine Daten löschen.

Bei Docker Compose:

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
```

Bei Git-Builds im bestehenden Projekt:

```bash
git fetch origin --tags
git checkout v1.0.7
sudo docker compose up -d --build
```

Eigene Compose-Mounts und Ports bei Wechsel auf die neue Vorlage erhalten. Bei Docker Run das neue Image pullen, den alten Container stoppen/entfernen und den vollständigen Run-Befehl mit unverändertem Volume erneut ausführen. `latest` aktualisiert laufende Container nicht automatisch.

**Niemals `docker compose down -v` oder ein Datenvolume löschen, um ein Update oder Passwort-Reset durchzuführen.**

## Passwort zurücksetzen

Nur der Docker-Host-Besitzer kann den Reset ausführen. Zuerst Netzwerkzugriff bis auf dein eigenes Gerät einschränken, alte Hash-ENV entfernen und Container neu erstellen. Dann für Dockhand/Synology mit Containername `shopping`:

```bash
sudo docker exec shopping node scripts/reset-login.mjs --allow-setup
```

Bei Compose im Projektordner alternativ:

```bash
sudo docker compose exec shopping node scripts/reset-login.mjs --allow-setup
```

Bei Docker Run den dort verwendeten Containernamen einsetzen (z. B. `smart-shopping-assistant`). Der Befehl widerruft Sitzungen, löscht nur die alte Passwortkonfiguration und Anmeldesperren und öffnet **Create Login** erneut. Sofort im Browser neues Passwort einrichten. Anwendungstabellen bleiben erhalten. Es gibt keinen E-Mail-Reset und kein Standardpasswort.

Nach fünf falschen Login-Versuchen greift eine 15-minütige Sperre, die auch Neustarts übersteht. Normalerweise abwarten.

## Backup, Import und Serverumzug

Unter **Einstellungen → Daten sichern & umziehen**:

1. Auf dem alten Server **Daten exportieren (ZIP)** wählen, ZIP extern sicher speichern.
2. Neuen Server mit kompatibler Version (ab 1.0.7) und separatem Datenvolume installieren.
3. Dort über **Create Login** ein eigenes Passwort anlegen.
4. ZIP auswählen, **ZIP prüfen**, Warnung lesen und Ersetzen bestätigen.
5. Einkaufslisten, Vorräte, Produkte und Kategorien kontrollieren, erst danach den alten Server abschalten.

| Wird exportiert/importiert | Nicht enthalten |
| --- | --- |
| Einkaufslisten, Artikel, Einkäufe und Mengen | Passwort und Passwort-Hash |
| Vorräte, Lagerorte, Produkte, Varianten, Kategorien, Einheiten | Sitzungen, Loginversuche, Secrets, API-Keys |
| Import-Historie, Buchungszuordnungen | Docker-Image, Compose, Serverkonfiguration |
| Exportzeit, App-/Schema-Version, SHA-256 | Browser-Einstellungen und temporäre Bon-/Bild-Uploads |

Der ZIP-Import ersetzt Haushaltsdaten, nicht die Zugangsdaten der Zielinstanz. Maximale ZIP-Größe 32 MiB, maximal 24 MiB Datenpayload. Validierung von ZIP, Prüfsummen, Version, Schema und Beziehungen. Vor dem Überschreiben wird ein Sicherheits-Backup unter `/data/backups/` angelegt; SQLite-Transaktion schützt vor teilweise importierten Daten. ZIP ist nicht verschlüsselt.

[Ausführliche Schritt-für-Schritt-Anleitung](https://github.com/Skoun181/smart-shopping-assistant/blob/v1.0.7/docs/backup-and-migration.md)

### Vollständige SQLite-Notfallsicherung (inklusive Zugangsdaten)

Zusätzlich weiterhin möglich:

```bash
sudo docker compose exec shopping node scripts/backup.mjs /data/backups/backup.db
sudo docker cp "$(sudo docker compose ps -q shopping)":/data/backups/backup.db "$HOME/ssa-backup.db"
sudo chown "$(id -u):$(id -g)" "$HOME/ssa-backup.db"
chmod 600 "$HOME/ssa-backup.db"
```

Die rohe SQLite-Sicherung enthält Passwort-Hashes und Sitzungshashes! Nur geschützt/verschlüsselt extern lagern. Beim Restore der rohen DB Container stoppen, bisherigen DB-Stand inkl. WAL/SHM sichern, konsistente Sicherung mit passenden Rechten wiederherstellen. Vorher in einer Testinstanz üben. `docker export` sichert keine Volume-Daten.

## Vorräte importieren

Unter **Vorräte → Scannen & importieren** Bon, Foto oder CSV auswählen, Vorschau prüfen und bestätigen.

- Bons: JPG/PNG/PDF/TXT bis 5 MiB, PDF maximal drei Seiten; lokale OCR.
- CSV: UTF-8, maximal 100 KB/200 Produktzeilen, Einheiten pcs, pack, g, kg, ml, l.
- Optionale lokale Bild-KI via Ollama. Nur falls benötigt, direkt unter dem Service in Compose ergänzen (keine .env):

```yaml
environment:
  PANTRY_VISION_URL: "http://192.168.178.60:11434/"
  PANTRY_VISION_MODEL: "DEIN_LOKALES_MODELL"
```

Nur eigenen privaten Ollama-Server, Cloud deaktivieren; Firewall begrenzen. Bereits abgehakte Einkäufe nicht zusätzlich vollständig importieren (Doppelbuchung). OCR-Vorschläge kontrollieren.

```csv
produkt;menge;einheit;kategorie;variante
H-Milch;2;l;Milchprodukte & Eier;
Äpfel;5;pcs;Obst & Gemüse;
```

## Fehlerdiagnose und Sicherheit

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 shopping
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Bei abweichendem Host-Port anpassen. Health-API meldet Version 1.0.7. Bei Synology Schreibrechte auf /data prüfen. Keine Zugangsdaten oder Datenbankdateien in Issues/Logs veröffentlichen.

- Ausschließlich vertrauenswürdige private Netze, kein ungesicherter öffentlicher Zugriff. HTTPS empfohlen. Der vereinfachte Proxy vertraut X-Forwarded-Proto. NGINX: korrekter Host, Protokoll, SSE-Buffering aus, client_max_body_size 34m für ZIP. [Netzwerk-Anleitung](https://github.com/Skoun181/smart-shopping-assistant/blob/v1.0.7/docs/network-access.md).
- Scrypt, serverseitige Sessions, HttpOnly-Cookies, Login-Limits, Same-Origin-Prüfung, Eingabevalidierung. Nichtprivilegierter Container, schreibgeschütztes Root-Dateisystem.
- Automatische Tests und Audit ersetzen kein unabhängiges Sicherheits-Audit.

## Entwicklung & Releases

SvelteKit, Svelte, TypeScript, Node.js 24, SQLite, REST/SSE, Tesseract, Poppler und Vitest.

- Stable: `stable/smart-shopping-assistant`; Develop: `develop/smart-shopping-assistant-next`.
- Neue Funktionen in Develop testen, neue finale Paketversion und Release Notes vorbereiten, PR nach Stable nach Freigabe mergen. GitHub Actions prüft Typen, Tests, Build, Audit, Compose und APIs. Bestehende Release-Tags bleiben unverändert.
- Freigegebene Versionen werden als GitHub-Release und Images auf Docker Hub und GHCR veröffentlicht. Der Upload benötigt für Maintainer das Secret DOCKERHUB_TOKEN, nicht für normale Nutzer.

## Grenzen und Lizenz

Keine vollständige Offline-Bearbeitung. KI-Ergebnisse können fehlerhaft sein. Quellcode öffentlich einsehbar; eine öffentliche Open-Source-Lizenz wurde bisher nicht festgelegt.

