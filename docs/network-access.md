# Netzwerkzugriff (1.0.7 Stable)

Direkter Zugriff und Reverse Proxy verwenden denselben HTTP-Port 3000 (bzw. den direkt in Compose gesetzten Host-Port). Für direkten HTTP-Zugriff ist keine Zusatzkonfiguration nötig. Für Proxy-Zugriff setzt die Anwendung eine explizite Liste vertrauenswürdiger Proxy-IP-Adressen voraus. Alte ORIGIN- und BIND_ADDRESS-Werte werden ignoriert. Das Passwort und Datenvolume bleiben erhalten.

## Zwei VMs

- Shopping: 192.168.0.150:3000
- NGINX: 192.168.0.66
- Lokaler DNS: A list.xc.local → 192.168.0.66 (.local ist für mDNS reserviert; alternativ home.arpa).

NGINX leitet an http://192.168.0.150:3000 weiter und setzt Host auf die ursprüngliche Browser-Adresse und X-Forwarded-Proto auf das tatsächliche Schema. Siehe [NGINX-Beispiel](../deploy/nginx-remote.example.conf). Bei NGINX Proxy Manager: Scheme http, Forward Hostname/IP 192.168.0.150, Forward Port 3000. SSE-Buffering deaktivieren und client_max_body_size 34m setzen (für die Backup-ZIP-Wiederherstellung); andere Uploads werden weiterhin durch die App begrenzt. TLS kann unabhängig am Proxy eingerichtet werden. Kein URL-Pfadpräfix.

## Update

Backup anlegen, extern sichern, `git fetch origin --tags` und `git checkout v1.0.7` ausführen. Falls aus einem früheren RC eine compose.override.yaml oder compose.remote-proxy.yaml für den zweiten Listener existiert, nur diese alte Proxy-Konfiguration entfernen bzw. eigene sonstige Einstellungen behalten. Dann docker compose config --quiet und docker compose up -d --build. Beide Zugangswege prüfen; ggf. erneut anmelden.

## Sicherheit

Setze `TRUSTED_PROXY_IPS` auf die IP-Adressen der Reverse Proxys, wie sie am Shopping-Server als direkte TCP-Gegenstellen erscheinen. Setze `PUBLIC_ORIGIN` auf die externe Origin einschließlich Schema und gegebenenfalls Port, beispielsweise `https://list.home.arpa`. Der Proxy muss `Host`, `X-Forwarded-Proto` und `X-Forwarded-For` selbst überschreiben. Für direkte Verbindungen bleibt HTTP im privaten Netz verfügbar.

Ein leeres Datenvolume erstellt das Konto nur mit einem einmaligen Setup-Token. Öffne zuerst die Login-Seite und lies das Token im Develop-Container mit `docker compose -f compose.develop.yaml exec shopping-develop cat /data/setup-token`. Ein Betreiber kann alternativ ein eigenes langes `APP_SETUP_TOKEN` im Container hinterlegen.
