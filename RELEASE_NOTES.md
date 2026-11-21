# Smart Shopping Assistant – Version 1.0.7 Stable

- **Create Login:** Beim ersten Start gemeinsames Passwort einrichten, ohne Benutzername oder manuelle Hash-Erzeugung. Scrypt-Hash persistent in SQLite; Einrichtung serverseitig nur einmal möglich.
- Keine .env oder Environment Variables für die Standardinstallation. Image-Tag und Host-Port direkt in Compose ändern. Eigene Synology-Vorlage mit Bind Mount.
- Bestehende gültige APP_PASSWORD_HASH-Werte werden einmalig übernommen; bei fehlendem/beschädigtem Passwort einer bestehenden Installation muss der Host-Administrator die Einrichtung lokal freigeben. Reset widerruft Sitzungen, behält Haushaltsdaten.
- Portabler ZIP-Export und -Import unter Einstellungen: Vorschau, Integrität, Schema, Sicherheits-Backup und transaktionaler Restore; keine Zugangsdaten im ZIP.
- Automatisierte Tests prüfen Setup-Rennen, Origin, Persistenz nach Container-Neuerstellung, Legacy-Migration, Reset und Backup.

## Update

Vorher konsistente externe Datenbanksicherung erstellen. Bestehende Mounts, Projektname und Port behalten. Bei funktionierendem alten Login zunächst mit dem alten Hash auf 1.0.7 aktualisieren, anmelden und anschließend die Passwort-ENV entfernen. Bei einem beschädigten Hash nach Entfernen der ENV lokal `docker exec shopping node scripts/reset-login.mjs --allow-setup` ausführen. Netzwerkzugriff während der Einrichtung auf den eigenen Client begrenzen.

[Installation und Passwort-Reset](https://github.com/Skoun181/smart-shopping-assistant/blob/v1.0.7/README.md) · [ZIP-Backup-Anleitung](https://github.com/Skoun181/smart-shopping-assistant/blob/v1.0.7/docs/backup-and-migration.md)

Nur für vertrauenswürdige private Netze.
