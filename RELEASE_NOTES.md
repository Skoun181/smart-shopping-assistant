# Smart Shopping Assistant – Version 1.0.6 Stable

## Verbesserungen
- Vorräte: Minus bis null und Entfernen ohne zusätzliche Bestätigung; Katalogprodukte bleiben erhalten.
- Einkaufsliste: direkte Plus-/Minus-Steuerung und genaue Mengeneingabe per Tipp.
- Abhaken erhöht automatisch den Vorrat am Standort Zuhause; gleiche Produkt-ID, Variante und Einheit werden zusammengeführt.
- Enthaken öffnet den Artikel für den nächsten Einkauf, ohne bestehenden Vorrat zu reduzieren. Erneutes Abhaken bucht die nächste gekaufte Menge zusätzlich. Löschen aus der Einkaufsliste verändert den Vorrat nicht.
- Transaktion und Versionsprüfung schützen vor doppelter Buchung durch wiederholte oder veraltete Anfragen. Live-Aktualisierung für Einkaufsliste und Vorräte.
- Keine neuen npm-Abhängigkeiten. SQLite-Migration läuft automatisch beim Start.

## Update
Vorher ein konsistentes SQLite-Backup erstellen und außerhalb der VM sichern. Im bestehenden Projektordner:

```bash
git fetch origin --tags
git checkout v1.0.6
sudo docker compose up -d --build
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Bestehende .env und Datenvolume behalten. Niemals `docker compose down -v` für ein Update verwenden. Health-Version: 1.0.6.

## Hinweise
Bereits vor der automatischen Vorratsbuchung abgehakte Artikel werden nicht nachträglich importiert. Durch frühere Entwicklungsversionen abgezogene Mengen werden nicht automatisch wiederhergestellt. Denselben Einkauf nicht zusätzlich komplett per Kassenbon importieren: Doppelbestände sind weiterhin möglich. Bei versehentlichem Abhaken kann der Bestand in Vorräte korrigiert werden.

Nur für vertrauenswürdige private Netze; keine Internet-Portfreigabe. Netzwerkzugriff wie in v1.0.1, siehe [Netzwerk-Anleitung](docs/network-access.md).
