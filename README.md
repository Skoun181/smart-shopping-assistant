# Smart Shopping Assistant 🛒

**Version: 0.3.0-beta.1 (Entwicklungs-Beta)**

Eigenständiger, privater Einkaufs- und Vorratsmanager für einen Haushalt. Kein Fork oder Clone von Koffan.

> ⚠️ **Beta-Kandidat:** Der Code liegt auf einem Entwicklungsbranch. Automatisierter Build, Docker-Start, API-Smoke-Tests und Produktions-Audit wurden erfolgreich in GitHub Actions ausgeführt. Tests im echten Heimnetz, HTTPS und Browser-End-to-End-Prüfungen stehen noch aus. Nicht als produktionsreif einstufen.

## Neu im kommenden Beta-Update: Produktauswahl und Kategorien

- Nach der ersten Anmeldung in einem Browser erscheint ein Willkommen-Dialog mit **Kacheln für den gesamten lokalen Produktkatalog**, individuellen Offline-Emojis, Suche und nach Kategorien gegliederter Auswahl.
- **Mehrfachauswahl**: Produkte wie in einer Fotogalerie antippen, Menge, Einheit und optional Variante einstellen und alle auf einmal zur Einkaufsliste übernehmen.
- Die gemeinsame Auswahl wird in **einer SQLite-Transaktion** gespeichert; ungültige Batches werden vollständig abgelehnt. Identische offene Positionen werden zusammengeführt.
- Die Einkaufsliste wird **nach Kategorien sortiert**, mit klappbaren Kategorieüberschriften, Fortschrittsanzeige und Emoji je Artikel.
- Die Galerie lässt sich überspringen und jederzeit über **Einkaufsliste → Mehrere auswählen** oder **Einstellungen → Produkttafel erneut öffnen** starten.
- Der Einführungsstatus und der Aufklappzustand werden **pro Browser lokal** gespeichert, nicht als geteilte Benutzerkonten-Information.

> **Hinweis für bestehende Beta-Tester:** Dieses Update liegt noch im Branch `feature/onboarding-tiles-categories` (PR #2). Es basiert auf der ersten Beta (PR #1). Für den Test auf Proxmox erst den Branch wechseln und ein Backup anlegen; nicht `main` verwenden.

## Neu in Beta 0.2: Vollständigerer Katalog, Freitext und Kategorien

- **Deutlich erweiterter Katalog:** u. a. Zewa, Küchenpapier, Toilettenpapier-Varianten, Binden, Tampons, Slipeinlagen, Windeln, Haushaltsreiniger, weitere Lebensmittel und Hygieneartikel.
- **Freitextprodukte direkt beim Einkaufen:** Bei `Einkaufsliste → Einzeln hinzufügen → Freitext eingeben` einen beliebigen Produktnamen und eine bestehende Kategorie wählen, optional Variante/Menge/Einheit/Notiz eingeben. Das Produkt wird im Katalog gespeichert und zugleich auf die Liste gesetzt.
- **Freitext im Vorrat:** Derselbe Eingabemodus steht unter `Vorräte → Hinzufügen` bereit.
- **Freitext direkt aus der Produkttafel:** Im Willkommens-Popup oder unter `Mehrere auswählen` kannst du fehlende Produkte frei erfassen.
- **Neuer Tab `Kategorien`:** Alle Produkte nach Kategorie durchsehen, Produkte jeder Art auf eine andere Kategorie umstellen (z. B. Cola zu Snacks), neue Kategorien mit deutschem/optional englischem Namen anlegen, eigene Kategorien umbenennen und *leere* eigene Kategorien wieder löschen.
- **Daten bleiben erhalten:** Die Migration `0002_custom_categories.sql` ergänzt die vorhandene SQLite-Datenbank, ohne Einkaufspositionen oder alte Produkt-IDs zu ersetzen. Zusätzliche Katalogprodukte werden idempotent eingespielt. Selbst vorgenommene Kategoriezuordnungen werden bei künftigen Neustarts nicht überschrieben.
- **Transaktional und abgesichert:** Freitextprodukt und Listen- bzw. Vorratsposition werden in einer Transaktion angelegt. Alle neuen Endpunkte bleiben mit Sitzung, Origin-Prüfung, Eingabevalidierung und parametrisiertem SQL geschützt.

## Neu in Beta 0.3: Vorratsimport mit Freigabe

- Produkt-Emojis erscheinen auch auf der Übersicht und in der Vorratsliste.
- Unter **Vorräte → Scannen & importieren** gibt es einen gemeinsamen Import-Assistenten. Ein Scan oder CSV erzeugt nur einen Entwurf, noch keine Vorratsdaten.
- Kassenbon: JPG/PNG per lokaler Tesseract-Texterkennung, digitale PDF-Dateien per Poppler (OCR-Fallback für reine Bild-PDFs), TXT. Erkennung von Preiszeilen ist heuristisch; Mengen werden nicht aus Preisen abgeleitet. Maximal 5 MiB, PDF maximal drei Seiten.
- Kühlschrank/Einkaufsfoto: optionale lokale Bild-KI über Ollama. Standardmäßig nicht konfiguriert; die CSV-Alternative funktioniert ohne Modell oder API-Schlüssel.
- CSV: UTF-8, maximal 100 KB und 200 Zeilen. Semikolon oder Komma als Trennzeichen; Kopfzeile `produkt;menge;einheit;kategorie;variante`. Einheiten pcs, pack, g, kg, ml, l; Dezimalpunkt oder Dezimalkomma (bei Kommatrennung Feld quoten). Unbekannte Menge leer lassen. CSV-Vorlage und KI-Prompt werden in der Oberfläche zum Download angeboten.
- Vorschau: Namen, Katalogzuordnung, Kategorien, Mengen, Einheiten und Varianten bearbeiten, Zeilen entfernen/ergänzen und ausdrücklich freigeben. Unbekannte Mengen/Kategorien müssen ausgefüllt werden.
- Bestätigte Zeilen werden gemeinsam transaktional hinzugefügt, nie als Bestandsersetzung. Wiederholung derselben Import-ID mit identischem Inhalt legt keine zusätzlichen Zeilen an. Erneutes Scannen einer Datei ist dagegen ein neuer Import; vorhandene Bestände deshalb vor Freigabe kontrollieren.
- Dateien werden nicht dauerhaft gespeichert; die lokale OCR nutzt temporäre Dateien, die nach der Verarbeitung entfernt werden. Keine automatische Übermittlung an externe Chat-KI. Bei selbst gewählter externer KI Kundendaten und Zahlungsinformationen vorher entfernen.
- Migration `0003_pantry_imports.sql` speichert ausschließlich Import-ID, Prüfsumme, Anzahl und Zeit; keine Bonbilder oder Rohtexte. Neue Produkte werden erst bei Freigabe erstellt.

### Optionale lokale Bild-KI

Auf einem separaten Rechner im Heimnetz Ollama samt lokalem bildfähigem Modell installieren (Modell und RAM/GPU passend zur Hardware auswählen). Ollamas Cloud-Funktionen deaktivieren (`OLLAMA_NO_CLOUD=1` auf dem Ollama-Host); Zugriff auf Port 11434 per Firewall ausschließlich von der Shopping-VM erlauben. Keine Internetfreigabe. Die Shopping-App verwendet nur eine vom Administrator konfigurierte private IPv4-Adresse, keine vom Browser übergebene URL.

In der vorhandenen `.env` ergänzen (Beispielwerte ersetzen):

```dotenv
PANTRY_VISION_URL=http://192.168.178.60:11434/
PANTRY_VISION_MODEL=your-installed-local-vision-model
```

Dann `sudo docker compose up -d --force-recreate`. Ohne diese Konfiguration bleiben Foto-KI und ihre Uploads deaktiviert. Der lokale OCR-/PDF- und CSV-Weg bleibt verfügbar. Bildqualität, Modellkompatibilität und Erkennung sind manuell mit realen Beispielen zu testen; keine Garantie für Vollständigkeit. Bei Kühlschrankfotos nur noch nicht erfasste Bestände auswählen.

### Update von Beta 0.2 auf Beta 0.3

Vor dem Update konsistentes SQLite-Backup anlegen und außerhalb der VM sichern. Dann im bestehenden Projektverzeichnis:

```bash
git status --short
git fetch origin
git switch --track origin/feature/pantry-import-assistant
sudo docker compose up -d --build
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Erwartete Version: 0.3.0-beta.1. Keine Volumes löschen. Die App benötigt für OCR/PDF keine neue npm-Abhängigkeit; die Werkzeuge stammen aus dem Alpine-Paketrepository im Container.

## Aktueller Funktionsumfang

- Gemeinsames Passwort über Scrypt-Hash in der Umgebung, keine Benutzerkonten
- Serverseitige Sessions mit Ablaufzeit und HTTP-only-Cookies, Login-Limitierung
- Kuratierter lokaler Produktkatalog mit Kategorien und Varianten
- Eigene Produkte und optionale Varianten anlegen
- Einkaufsliste: hinzufügen, abhaken, Menge bearbeiten, entfernen, identische offene Artikel zusammenführen
- Einfache Vorratsliste mit Mengen und Einheiten
- Echtzeitbenachrichtigungen über Server-Sent Events
- Responsive Design: Dark Mint und Dark Violet; Deutsch und Englisch pro Browser
- PWA-Manifest und Cache für statische Dateien, keine Offline-Bearbeitung
- SQLite mit versionierten SQL-Migrationen, Docker-Volume, Healthcheck und Backup-Skript

**Geplant, noch nicht vorhanden:** Rezepte, Chefkoch-Integration, Prospekte, Preisvergleiche, OCR, Barcode-Scan, Ablaufdaten, vollständige Offline-Synchronisierung.

## Voraussetzungen

- Linux-Server mit Docker und Docker Compose Plugin
- Zum Erzeugen des Passwort-Hashes: Node.js 24 auf einem Rechner
- Für sicheren Dauerbetrieb: lokaler HTTPS-Reverse-Proxy mit vertrauenswürdigem Zertifikat

## Erste Installation (Testbetrieb)

1. Repository klonen (privates GitHub-Repository; Anmeldung erforderlich).
2. Zum Branch feature/beta-0.1-foundation wechseln.
3. Die Datei .env.example nach .env kopieren.
4. Mit Node.js 24: `npm ci` und `npm run hash-password`; alternativ direkt über Docker: `docker run --rm -it -v "$PWD/scripts:/work:ro" -w /work node:24-alpine node hash-password.mjs`. Die erzeugte `APP_PASSWORD_HASH`-Zeile vollständig nach `.env` übernehmen, **einschließlich der einfachen Anführungszeichen**, damit Docker Compose die Dollarzeichen nicht interpoliert.
5. In .env die ORIGIN auf die **exakte** im Browser verwendete Adresse einstellen. Lokal am Server beispielsweise http://localhost:3000.
6. docker compose up -d --build starten.
7. Dieselbe URL im Browser aufrufen und anmelden.

**Standardmäßig ist BIND_ADDRESS=127.0.0.1**, daher nur am Server selbst erreichbar. Für einen **vorübergehenden** LAN-Test kann BIND_ADDRESS=0.0.0.0 und ORIGIN=http://SERVER-IP:3000 gewählt werden. Dabei ist HTTP unverschlüsselt. Für den Dauerbetrieb ausschließlich HTTPS mit vertrauenswürdigem Zertifikat verwenden, idealerweise über einen Reverse Proxy mit lokalem App-Port. **Keine Router-Portfreigabe!**

## Sicherheit

- Nie Klartextpasswort oder .env in GitHub, Screenshots oder Chats übertragen.
- Beim Login wird das gemeinsame Passwort mit Scrypt und einem Salt überprüft.
- Zufällige Session-Tokens werden in SQLite nur als SHA-256-Hash gespeichert.
- Cookies sind HTTP-only und SameSite=Lax; unter HTTPS zusätzlich Secure.
- Schreibende API-Endpunkte prüfen die Origin gegen die konfigurierte URL.
- Zod validiert JSON-Eingaben, SQL-Statements sind parametrisiert.
- Nach fünf Fehlschlägen pro IP wird der Login zeitweise gesperrt.
- Minimaler Docker-Container, kein Root, keine zusätzlichen Linux-Capabilities.

## Backups und Restore

Die persistente Datenbank liegt im Container unter /data/shopping.db und im Docker-Volume shopping_data. SQLite verwendet WAL.

Ein konsistentes Backup erzeugen:

    docker compose exec shopping node scripts/backup.mjs /data/backups/backup.db

Die Backup-Datei befindet sich zunächst **im selben Volume**. Kopiere sie für echten Schutz unbedingt zusätzlich aus dem Docker-Volume auf ein anderes Gerät. Für eine Wiederherstellung Container stoppen, bisherigen Datenbankstand sichern, Backup-Datei als shopping.db wiederherstellen und Container starten. Restore regelmäßig auf einer Testinstanz prüfen.

## Updates und Tests

Vor jedem Update Backup erstellen. Anschließend Branch aktualisieren und docker compose up -d --build aufrufen. Die SQL-Migrationen werden automatisch angewendet. GitHub Actions prüft Typecheck, Unit-Tests, Build, Produktions-Audit und Docker-Build. Dependabot soll wöchentlich Paket- und Image-Updates vorschlagen.

**Paketversionen:** Das npm-Lockfile ist eingecheckt; CI und Docker verwenden `npm ci` für reproduzierbare Installationen. Automatisierte Container-API-Tests waren erfolgreich. Browser-End-to-End-Tests und Tests im echten Heimnetz stehen noch aus.

## Technischer Aufbau

SvelteKit, Svelte 5, TypeScript, Tailwind CSS 4, Node.js, better-sqlite3, REST-Endpunkte unter /api/v1 und SSE. Eine lokale SQLite-Datenbank, keine externe Telemetrie. Theme und Sprache werden pro Browser gespeichert.

API-Endpunkte: POST /api/v1/auth/login, POST /api/v1/auth/logout; GET/POST /api/v1/catalog; GET/POST /api/v1/shopping; POST /api/v1/shopping/bulk; PATCH/DELETE /api/v1/shopping/:id; GET/POST /api/v1/pantry; PATCH/DELETE /api/v1/pantry/:id; GET /api/v1/events; GET /api/v1/health.

Alle API-Endpunkte außer Login und Healthcheck verlangen eine gültige Session. Bei PATCH schützt expectedVersion gegen unbemerktes Überschreiben paralleler Änderungen.

## Einschränkungen

- Derzeit nur eine Standard-Einkaufsliste, auch wenn das Datenmodell mehr erlaubt.
- Vorräte werden unabhängig von der Einkaufsliste manuell geführt.
- SSE funktioniert innerhalb eines Node-Prozesses, nicht über mehrere Serverinstanzen.
- Der Katalog ist bewusst kuratiert, keine vollständige Supermarkt-Produktdatenbank.
- Für breitere PWA-Kompatibilität fehlen noch native PNG-Icons.
- Browser-End-to-End-Tests und Tests auf dem Zielserver sind noch nicht abgeschlossen.

## Proxmox-Beta-Update für bestehende Tester

Vor dem Branchwechsel ein SQLite-Backup anlegen und nach Möglichkeit extern sichern:

```bash
cd ~/apps/smart-shopping-assistant
sudo docker compose exec shopping node scripts/backup.mjs /data/backups/pre-gallery.db
sudo docker cp "$(sudo docker compose ps -q shopping)":/data/backups/pre-gallery.db "$HOME/pre-gallery.db"
sudo chown "$USER:$USER" "$HOME/pre-gallery.db"
chmod 600 "$HOME/pre-gallery.db"

git fetch origin
git switch --track origin/feature/onboarding-tiles-categories
sudo docker compose up -d --build
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Die `.env`-Datei, Passwort-Hashes und das Docker-Volume bleiben unverändert. Nicht `docker compose down -v` ausführen; das würde das Datenvolume löschen. Anschließend im Browser neu laden. Der Einführungsdialog erscheint einmal je Browserinstallation und kann im Einstellungsmenü erneut geöffnet werden.

## Bestehende Proxmox-Beta sicher auf Beta 0.2 aktualisieren

Der neue Code liegt auf dem Branch `feature/catalog-management-and-free-text` (PR #3), aufbauend auf `feature/onboarding-tiles-categories` (PR #2). **Vor dem Update ein Backup erzeugen, außerhalb der VM sichern und den Testbranch bewusst wechseln.**

```bash
cd ~/apps/smart-shopping-assistant

# SQLite konsistent sichern, solange der Container läuft:
sudo docker compose exec shopping node scripts/backup.mjs /data/backups/pre-beta02.db
sudo docker cp "$(sudo docker compose ps -q shopping)":/data/backups/pre-beta02.db "$HOME/pre-beta02.db"
sudo chown "$USER:$USER" "$HOME/pre-beta02.db"
chmod 600 "$HOME/pre-beta02.db"

# Branch auschecken und unveränderte .env sowie Docker-Volume behalten:
git fetch origin
git switch --track origin/feature/catalog-management-and-free-text
sudo docker compose up -d --build

# Status und Datenbankmigration prüfen:
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Das Ergebnis der Health-API muss `"version":"0.2.0-beta.1"` enthalten. Die Anmeldung und bisherigen Artikel bleiben erhalten. Browseransicht ggf. per **Strg+Shift+R** neu laden. **Nicht `docker compose down -v` ausführen** – das entfernt das SQLite-Volume. Für einen belastbaren Backup-Plan die `pre-beta02.db` auch außerhalb der VM aufbewahren.

**Manuelle Abnahme:** Im Katalog „Binden“ und „Tampons“ suchen; einen unbekannten Freitextartikel inklusive Kategorie hinzufügen; in `Kategorien` Cola nach `Snacks & Süßes` verschieben und die Anzeige nach einem Neustart erneut prüfen. Einen neuen Kategorienamen erstellen und ein Produkt hineinverschieben. Erst nach manuellen Proxmox-Tests freigeben.

## Entwicklungsworkflow und Lizenz

Feature-Branch → Pull Request → GitHub Actions → Review → Merge nach main. Der Quellcode liegt privat; eine öffentliche Lizenz ist noch nicht festgelegt.