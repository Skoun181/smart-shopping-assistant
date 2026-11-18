# Smart Shopping Assistant 🛒

**Version: 0.1.0-beta.1 (Entwicklungs-Beta)**

Eigenständiger, privater Einkaufs- und Vorratsmanager für einen Haushalt. Kein Fork oder Clone von Koffan.

> ⚠️ **Beta-Kandidat:** Der Code liegt auf einem Entwicklungsbranch. Automatisierter Build, Docker-Start, API-Smoke-Tests und Produktions-Audit wurden erfolgreich in GitHub Actions ausgeführt. Tests im echten Heimnetz, HTTPS und Browser-End-to-End-Prüfungen stehen noch aus. Nicht als produktionsreif einstufen.

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

API-Endpunkte: POST /api/v1/auth/login, POST /api/v1/auth/logout; GET/POST /api/v1/catalog; GET/POST /api/v1/shopping; PATCH/DELETE /api/v1/shopping/:id; GET/POST /api/v1/pantry; PATCH/DELETE /api/v1/pantry/:id; GET /api/v1/events; GET /api/v1/health.

Alle API-Endpunkte außer Login und Healthcheck verlangen eine gültige Session. Bei PATCH schützt expectedVersion gegen unbemerktes Überschreiben paralleler Änderungen.

## Einschränkungen

- Derzeit nur eine Standard-Einkaufsliste, auch wenn das Datenmodell mehr erlaubt.
- Vorräte werden unabhängig von der Einkaufsliste manuell geführt.
- SSE funktioniert innerhalb eines Node-Prozesses, nicht über mehrere Serverinstanzen.
- Der Katalog ist bewusst kuratiert, keine vollständige Supermarkt-Produktdatenbank.
- Für breitere PWA-Kompatibilität fehlen noch native PNG-Icons.
- Browser-End-to-End-Tests und Tests auf dem Zielserver sind noch nicht abgeschlossen.

## Entwicklungsworkflow und Lizenz

Feature-Branch → Pull Request → GitHub Actions → Review → Merge nach main. Der Quellcode liegt privat; eine öffentliche Lizenz ist noch nicht festgelegt.