# Netzwerkzugriff (1.0.1 RC)

Direkter Zugriff und Reverse Proxy verwenden denselben HTTP-Port 3000 (bzw. den vorhandenen APP_PORT). Keine zusätzliche Compose-Datei, keine Proxy-IP-Freigabeliste und keine Origin-Einstellung in .env nötig. Alte ORIGIN- und BIND_ADDRESS-Werte werden ignoriert. Das Passwort und Datenvolume bleiben erhalten.

## Zwei VMs

- Shopping: 192.168.0.150:3000
- NGINX: 192.168.0.66
- Lokaler DNS: A list.xc.local → 192.168.0.66 (.local ist für mDNS reserviert; alternativ home.arpa).

NGINX leitet an http://192.168.0.150:3000 weiter und setzt Host auf die ursprüngliche Browser-Adresse und X-Forwarded-Proto auf das tatsächliche Schema. Siehe [NGINX-Beispiel](../deploy/nginx-remote.example.conf). Bei NGINX Proxy Manager: Scheme http, Forward Hostname/IP 192.168.0.150, Forward Port 3000. SSE-Buffering deaktivieren und client_max_body_size 6m setzen. TLS kann unabhängig am Proxy eingerichtet werden. Kein URL-Pfadpräfix.

## Update

Backup anlegen, extern sichern, Git-Branch feature/automatic-network-access auschecken/aktualisieren. Falls aus einem früheren RC eine compose.override.yaml oder compose.remote-proxy.yaml für den zweiten Listener existiert, nur diese alte Proxy-Konfiguration entfernen bzw. eigene sonstige Einstellungen behalten. Dann docker compose config --quiet und docker compose up -d --build. Beide Zugangswege prüfen; ggf. erneut anmelden.

## Sicherheit

Bewusst vereinfachter LAN-Betrieb: X-Forwarded-Proto kann von jedem erreichbaren Client gesetzt werden; der Server kann den tatsächlichen externen TLS-Status nicht unabhängig überprüfen. Darum nur im vertrauenswürdigen Heimnetz betreiben, Port 3000 per Proxmox-/Netzwerkfirewall begrenzen und keine Internetfreigabe einrichten. NGINX muss Host und X-Forwarded-Proto zuverlässig setzen. HTTP ist unverschlüsselt. Login-Throttling nutzt die TCP-Peer-IP, nicht frei übergebene Client-IP-Header; alle Clients hinter einem Proxy können sich daher ein Limit teilen. Sessions, Passwortprüfung und Same-Origin-Prüfung bleiben aktiv. HTTPS nutzt Secure-/HttpOnly-Cookies. Für eine öffentliche Bereitstellung wäre ein explizites Proxy-Vertrauensmodell nötig.
