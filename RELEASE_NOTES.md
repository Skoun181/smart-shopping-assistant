# Smart Shopping Assistant – Version 1.0.0 Stable

Erster stabiler Release des selbst gehosteten Einkaufs- und Vorratsassistenten.

## Funktionen
- Gemeinsame Einkaufslisten, Produktkacheln, Freitext, Varianten und Live-Aktualisierung.
- Kuratierter Produktkatalog, eigene Produkte und frei zuordenbare Kategorien.
- Einklappbare Vorratskategorien, Mengensteuerung und Verbrauch.
- Lokaler Kassenbon-Import (Bild, PDF, TXT), regelbasierter Produktabgleich und kontrollierte Freigabe.
- CSV-Import mit Vorlage und KI-Prompt; optionale lokale Ollama-Bild-KI.
- Responsive Oberfläche, zwei Dark-Themes, Deutsch/Englisch und PWA-Grundlagen.
- Docker Compose, SQLite, Passwortschutz, Backup-Skript und automatisierte Qualitätsprüfungen.

## Update
Vor dem Wechsel ein SQLite-Backup anlegen und außerhalb der VM sichern. In der bestehenden Installation:
```bash
git fetch origin --tags
git checkout v1.0.0
sudo docker compose up -d --build
sudo docker compose ps
```
Die bestehende .env und das Datenvolume beibehalten. Nicht docker compose down -v ausführen.

## Hinweise
Für vertrauliche Daten HTTPS oder einen verschlüsselten SSH-Tunnel verwenden. Die optionale Foto-KI benötigt einen separat eingerichteten lokalen Ollama-Dienst. Bon-Zuordnungen bleiben Vorschläge und müssen kontrolliert werden. Rezeptvorschläge, Angebote und vollständige Offline-Synchronisation sind noch nicht enthalten. Stable bezeichnet den ersten freigegebenen Funktionsstand, keine unabhängige Sicherheitszertifizierung.

Die ausführliche Anleitung steht im README.
