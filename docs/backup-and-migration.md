# ZIP-Backup, Import und Serverumzug – Schritt für Schritt

Diese Anleitung beschreibt die neue Backup-Oberfläche im **Develop-Branch**. Das bislang veröffentlichte Image v1.0.6 enthält diese Funktion noch nicht. Erst ein künftiger freigegebener Release wird damit auf Docker Hub verfügbar sein.

## Die neue Funktion schon jetzt in Develop testen

Du musst nicht auf das nächste Docker-Hub-Image warten. Auf einer **separaten Test-VM** kannst du den Develop-Branch direkt als eigenes Docker-Image bauen. Bestehende Produktivdaten nicht ohne vorheriges Backup überschreiben.

```bash
mkdir -p ~/apps
cd ~/apps
git clone --branch develop/smart-shopping-assistant-next \
  https://github.com/Skoun181/smart-shopping-assistant.git
cd smart-shopping-assistant
umask 077
cp .env.example .env
chmod 600 .env
sudo docker run --rm -it --network none \
  -v "$PWD/scripts:/work:ro" -w /work \
  node:24-alpine node hash-password.mjs
nano .env
```

Die vollständige generierte Zeile `APP_PASSWORD_HASH='scrypt$...'` in `.env` eintragen. Ggf. `APP_PORT=8080` verwenden, wenn 3000 belegt ist. Dann:

```bash
sudo docker compose up -d --build
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Wenn APP_PORT=8080 eingestellt ist, stattdessen den Health-Check über Port 8080 aufrufen. Im Browser die Testinstanz öffnen, mit dem eigenen Passwort anmelden und **Einstellungen → Daten sichern & umziehen** aufrufen. Testdaten anlegen, exportieren und anschließend auf einer zweiten Develop-Testinstanz importieren.

**Achtung:** Der Health-Check kann weiterhin `1.0.6` als technische Basisversion melden; die Oberfläche kennzeichnet diesen Stand ausdrücklich als **DEV**. Der veröffentlichte Stable-Tag `v1.0.6` und das Docker-Hub-Image `1.0.6` enthalten die neue Funktion nicht.

## Was wird gespeichert?

| Bestandteil | Export |
| --- | --- |
| Einkaufslisten, gekaufte Artikel, Mengen | Ja |
| Vorräte, Lagerorte und Mengen | Ja |
| Produktkatalog, eigene Produkte, Varianten und Kategorien | Ja |
| Maßeinheiten, Buchungszuordnungen und bestätigte Import-Historie | Ja |
| Exportdatum, App-Version, Schema-Version, Prüfsumme | Ja |
| Dauerhaft gespeicherte Upload-Dateien | Nicht vorhanden: Bilder und Bons werden bisher nur temporär verarbeitet |
| Passwort, Passwort-Hash, Cookies und Sitzungen | **Nein** |
| API-Tokens, Login-Versuche, technische Server-Einstellungen | **Nein** |
| .env, Docker-Compose, Docker-Image | **Nein** |
| Browser-Sprache und Design | **Nein** (im Browser gespeichert) |

Die ZIP enthält `manifest.json` und `data.json`. Sie ist ein portabler strukturierter SQLite-Datenauszug, **keine ungeschützte Kopie der vollständigen Datenbankdatei**. Sie ist nicht verschlüsselt: bitte sicher lagern und niemals öffentlich hochladen.

## 1. Auf dem alten Server exportieren

1. Smart Shopping Assistant im Browser öffnen und anmelden.
2. Zu **Einstellungen** bzw. **Mehr** wechseln.
3. Unter **Daten sichern & umziehen** auf **Daten exportieren (ZIP)** klicken.
4. Die Datei `smart-shopping-assistant-backup-YYYYMMDD-HHMMSS.zip` herunterladen.
5. Eine zweite Kopie auf einem anderen Gerät aufbewahren. Den alten Server noch nicht löschen.

## 2. Neuen Server vorbereiten

1. Debian/Ubuntu oder eine neue Proxmox-VM installieren und Docker Engine plus Docker Compose Plugin einrichten.
2. Ein frisches Projektverzeichnis erstellen:

```bash
mkdir -p ~/apps/smart-shopping-assistant
cd ~/apps/smart-shopping-assistant
curl -fsSL https://raw.githubusercontent.com/Skoun181/smart-shopping-assistant/stable/smart-shopping-assistant/compose.dockerhub.yaml -o compose.yaml
```

3. Das Container-Image auf die **erste veröffentlichte Version mit Backup-Unterstützung** einstellen. Der bereits vorhandene Tag `1.0.6` dient nur als Beispiel für die Passwort-Generierung, da er die neuen Backup-Menüs noch nicht enthält.

4. Neues Passwort (mindestens zwölf Zeichen) als lokalen Hash erzeugen:

```bash
sudo docker pull skoun181/smart-shopping-assistant:1.0.6
sudo docker run --rm -it --network none --entrypoint node \
  skoun181/smart-shopping-assistant:1.0.6 scripts/hash-password.mjs
umask 077
nano .env
```

Dort den ausgegebenen `APP_PASSWORD_HASH='scrypt$...'` vollständig einfügen. Die einfachen Anführungszeichen gehören zu Compose. Zusätzlich beispielsweise `APP_PORT=3000` und `SSA_IMAGE_TAG=VERSION_MIT_BACKUP` eintragen. `VERSION_MIT_BACKUP` durch den tatsächlich veröffentlichten, kompatiblen Release-Tag ersetzen.

5. Sobald ein entsprechendes Image veröffentlicht wurde:

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
```

## 3. Auf dem neuen Server importieren

1. Auf `http://NEUE-SERVER-IP:3000` mit dem **neuen Passwort** anmelden.
2. Unter **Einstellungen → Daten sichern & umziehen** die ZIP auswählen.
3. **ZIP prüfen** anklicken. Die Anwendung prüft Integrität, Dateigröße, Quellversion und Schema und zeigt Datum sowie Anzahl der Datensätze.
4. Auf **Vorhandene Daten ersetzen** klicken und die ausdrückliche Warnung bestätigen.
5. Die App erstellt vor dem Import ein Sicherheits-Backup des aktuellen Zielzustands unter `/data/backups/`. Danach ersetzt sie die Haushaltsdaten **atomar in einer SQLite-Transaktion**. Im Fehlerfall erfolgt ein Rollback.
6. Erfolgsmeldung prüfen, danach Einkaufslisten, Produkte, Kategorien und Vorräte öffnen. Kein zusätzlicher Neustart nötig.
7. Erst wenn alles korrekt ist, den alten Server abschalten. Zwei getrennte Instanzen synchronisieren sich nicht automatisch.

**Wichtig:** Quell- und Zielsystem müssen dieselben Datenbankmigrationen besitzen; die Backup-Version darf nicht neuer oder eine andere Major-Version sein. Bei Versionskonflikten zuerst die passende Version installieren bzw. das alte System aktualisieren, dann erneut exportieren. Der Import nimmt keine stillen Schema-Konvertierungen vor.

## 4. Optional: Backup-Datei mit SCP übertragen

Wenn du die ZIP auf den neuen Server kopieren möchtest:

```bash
scp "smart-shopping-assistant-backup-YYYYMMDD-HHMMSS.zip" BENUTZER@NEUE-SERVER-IP:~/
```

Für den **Browser-Import** die ZIP weiterhin über den Datei-Auswahldialog auswählen (beispielsweise am PC, auf dem sie heruntergeladen wurde). Nicht selbst in das SQLite-Volume entpacken.

## 5. Docker-Volumes, Compose und Stack-Manager

- **Code/Image:** GitHub oder Docker Hub; bei einem Umzug einfach neu herunterladen.
- **Konfiguration:** .env oder Environment Variables im Stack-Manager, Port, optionale lokale Ollama-Einstellungen – **separat** auf dem Ziel neu setzen.
- **Daten:** Benanntes Volume `shopping_data`, DB unter `/data/shopping.db`. Es existieren keine persistent gespeicherten Bons/Fotos.
- **Sicherheits-Backups:** Im selben Volume unter `/data/backups/`. Für dauerhafte Aufbewahrung nach extern kopieren.

`docker export` sichert **keine** Daten aus Docker-Volumes. Verwende den ZIP-Export oder eine separat erstellte konsistente SQLite-Sicherung.

**Docker Run:** Dasselbe Volume wie beim Start verwenden, beispielsweise `-v ssa_run_data:/data`. Die .env.run darf den Hash ohne umgebende Anführungszeichen enthalten.

**Grafischer Stack-Manager (z. B. Dockhand oder Portainer):** Auf dem Ziel einen neuen Stack mit der Compose-Konfiguration ohne `env_file` erstellen, `APP_PASSWORD_HASH` und `APP_PORT` unter Environment Variables eintragen, deployen und die ZIP anschließend über die App importieren. Eine [Anleitung mit Screenshot](https://github.com/Skoun181/smart-shopping-assistant/blob/stable/smart-shopping-assistant/README.md) steht in der README.

**Portwechsel:** `APP_PORT=8080` setzt den externen Port auf 8080; intern bleibt 3000. Dann `http://NEUE-SERVER-IP:8080` öffnen.

### Server-Sicherheits-Backup nach dem Import extern sichern

Die Erfolgsmeldung enthält einen Dateinamen wie `pre-import-YYYYMMDD-HHMMSS-a1b2c3d4.zip`. Bei Docker Compose im richtigen Projektordner:

```bash
sudo docker cp "$(sudo docker compose ps -q shopping)":/data/backups/DATEINAME.zip "$HOME/DATEINAME.zip"
sudo chown "$(id -u):$(id -g)" "$HOME/DATEINAME.zip"
chmod 600 "$HOME/DATEINAME.zip"
```

`DATEINAME` ersetzen; bei einer abweichenden Compose-Datei stets dieselbe `-f`-Option wie beim Start verwenden.

## Sicherheit, Grenzen und Fehlersuche

- Authentifizierung ist erforderlich. Für schreibende Requests wird der Origin-Header geprüft.
- ZIP maximal **32 MiB**, darin höchstens **24 MiB Nutzdaten**. Nur zwei festgelegte Dateien im ZIP; keine fremden ZIP-Einträge, ZIP64 oder ZIP-Bomben.
- Prüfsummen, Tabellen, Spalten, Schema und Fremdschlüssel werden serverseitig geprüft.
- Vor dem ersten Löschvorgang wird innerhalb derselben SQLite-Transaktion ein automatisch gesichertes Export-ZIP der bisherigen Daten auf dem Zielserver geschrieben. Wenn das fehlschlägt, werden keine Daten ersetzt.
- Passwort, aktive Sitzungen, Login-Versuche, Schema-Migrationen und technische Einstellungen der Zielinstanz bleiben erhalten.
- Die ZIP enthält Haushaltsdaten und sollte geschützt aufbewahrt werden. Keine echten Zugangsdaten in Screenshots, Chats oder Issues hochladen.
- Bei Fehlern `sudo docker compose logs shopping --tail=100` prüfen (vor dem Teilen anonymisieren).
- Wenn der Browser die Verbindung während des Imports verliert, zunächst prüfen, ob die Wiederherstellung trotzdem abgeschlossen wurde, bevor dieselbe Datei erneut importiert wird.
- Export und Import zuerst zwischen **zwei Testinstanzen** ausprobieren, die Daten vergleichen und den alten Server erst danach abschalten.

## Häufige Fragen

**Wird mein Passwort übertragen?** Nein. Es wird auf dem Zielsystem neu eingerichtet.

**Kann ich das Backup in ein älteres Image importieren?** Nein, inkompatible Versions- und Schema-Stände werden abgelehnt.

**Was passiert mit vorhandenen Daten?** Nach Bestätigung ersetzt der Import die Haushaltsdaten; vorher liegt ein Sicherheits-Backup im Ziel-Volume.

**Wie komme ich an das Sicherheits-Backup?** Mit `docker cp` aus `/data/backups/` kopieren (Beispiel oben). Die ZIP kann bei Bedarf über den gleichen Importdialog zurückgespielt werden.
