# Smart Shopping Assistant – Version 1.0.1 Stable

## Neu
- Direkter LAN-Zugriff über IP und Port 3000.
- Optionaler NGINX Reverse Proxy (auch auf einer separaten VM) mit demselben Upstream-Port.
- Automatische Origin- und Protokollerkennung, ohne Änderung der bestehenden .env.
- HTTP-/HTTPS-spezifische Session-Cookies, unveränderte Passwort- und Same-Origin-Prüfungen.
- Aktualisierte Netzwerk-Dokumentation und NGINX-Konfigurationsbeispiele.
- Keine neue Datenbankmigration oder npm-Abhängigkeiten.

## Update
Vorher ein konsistentes SQLite-Backup erstellen und außerhalb der VM sichern. Im bisherigen Projektordner:

```bash
git fetch origin --tags
git checkout v1.0.1
sudo docker compose up -d --build
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Bestehende .env und Datenvolume behalten. Alte experimentelle Port-3001-Overrides entfernen, sonstige lokale Einstellungen beibehalten. Health-Version: 1.0.1.

## Sicherheit und Grenzen
Nur für vertrauenswürdige private Netze. Port 3000 per Netzwerkfirewall einschränken, keine Internet-Portfreigabe. Das vereinfachte Proxy-Modell akzeptiert X-Forwarded-Proto ohne Proxy-IP-Allowlist; NGINX muss Host und Scheme setzen. HTTP ist unverschlüsselt. Login-Limits beziehen sich auf den TCP-Peer (hinter NGINX gemeinsam). Für vertrauliche Daten HTTPS nutzen. Reale NGINX-/Browser-Tests auf der eigenen Installation bleiben erforderlich.

[Netzwerk-Anleitung](docs/network-access.md)
