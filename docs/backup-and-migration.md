# ZIP-Backup, Import und Serverumzug – Schritt für Schritt

Ab **Stable 1.0.7** verfügbar. Bei einer älteren Version zuerst sicher aktualisieren (siehe README). Keine .env-Datei nötig.

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
curl -fsSL https://raw.githubusercontent.com/Skoun181/smart-shopping-assistant/v1.0.7/compose.dockerhub.yaml -o compose.yaml
```

3. Image-Tag `1.0.7` und gewünschten Host-Port direkt in compose.yaml prüfen. Keine .env erzeugen.
4. Container starten:

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
```

## 3. Auf dem neuen Server importieren

1. Auf `http://NEUE-SERVER-IP:3000` **Create Login** öffnen und ein eigenes Passwort erstellen. Zugriff während des Setups begrenzen.
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
- **Konfiguration:** Compose-Datei, direkter Host-Port, Image-Tag und optionale lokale Ollama-Einstellungen – **separat** auf dem Ziel neu setzen.
- **Daten:** Benanntes Volume `shopping_data`, DB unter `/data/shopping.db`. Es existieren keine persistent gespeicherten Bons/Fotos.
- **Sicherheits-Backups:** Im selben Volume unter `/data/backups/`. Für dauerhafte Aufbewahrung nach extern kopieren.

`docker export` sichert **keine** Daten aus Docker-Volumes. Verwende den ZIP-Export oder eine separat erstellte konsistente SQLite-Sicherung.

**Docker Run:** Dasselbe Volume wie beim Start verwenden, beispielsweise `-v ssa_run_data:/data`. Keine Passwort-ENV nötig.

**Grafischer Stack-Manager (z. B. Dockhand oder Portainer):** Auf dem Ziel einen neuen Stack mit der Compose-Konfiguration ohne `env_file` erstellen, Port und Image-Tag direkt eintragen, deployen, Passwort über Create Login anlegen und ZIP importieren. Eine [Anleitung](https://github.com/Skoun181/smart-shopping-assistant/blob/stable/smart-shopping-assistant/README.md) steht in der README.

**Portwechsel:** `ports: ["8080:3000"]` setzt den externen Port auf 8080; intern bleibt 3000. Dann `http://NEUE-SERVER-IP:8080` öffnen.

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

**Wird mein Passwort übertragen?** Nein. Es wird auf dem Zielsystem über Create Login neu eingerichtet. Eine rohe SQLite-Sicherung hingegen enthält den Passwort-Hash und Sitzungsdaten; diese separat verschlüsselt aufbewahren.

**Kann ich das Backup in ein älteres Image importieren?** Nein, inkompatible Versions- und Schema-Stände werden abgelehnt.

**Was passiert mit vorhandenen Daten?** Nach Bestätigung ersetzt der Import die Haushaltsdaten; vorher liegt ein Sicherheits-Backup im Ziel-Volume.

**Wie komme ich an das Sicherheits-Backup?** Mit `docker cp` aus `/data/backups/` kopieren (Beispiel oben). Die ZIP kann bei Bedarf über den gleichen Importdialog zurückgespielt werden.
