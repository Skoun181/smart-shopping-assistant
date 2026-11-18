# Network access / Netzwerkzugriff (1.0.1 RC)

## Direkt im Heimnetz

Docker Compose veröffentlicht die App standardmäßig über IPv4 auf dem Host-Port 3000 (bzw. dem bereits gesetzten APP_PORT). Browser: http://SERVER-IP:3000 (private IPv4-Adresse der Debian-VM). Der Hostname localhost funktioniert ebenfalls. Die App ermittelt Schema und Host je Anfrage; alte ORIGIN- und BIND_ADDRESS-Einträge in .env werden ignoriert. Passwort und sonstige Einstellungen bleiben erhalten.

**Achtung:** Der frühere localhost-only-Modus wird dadurch bewusst zur LAN-Freigabe. Beschränke den direkten Port auf vertrauenswürdige Heimnetz-Clients (Proxmox-/Netzwerkfirewall, bei Docker zusätzlich Forwarding-Regeln beachten). Kein Router-Portforwarding. HTTP ist unverschlüsselt; für vertrauliche Daten HTTPS oder SSH-Tunnel nutzen. Für einen reinen Proxybetrieb kann der direkte Port in einem Compose-Override wieder an 127.0.0.1 gebunden werden. APP_PORT=3001 ist reserviert und darf nicht für den direkten Zugang verwendet werden.

## Optional: NGINX mit eigener HTTPS-Domain

Der zweite Listener läuft im selben App-Container auf Port 3001 und wird absichtlich nur auf 127.0.0.1 des Docker-Hosts veröffentlicht. Nur vertrauenswürdige Proxys dürfen ihn erreichen. Der direkte LAN-Port akzeptiert keine Forwarded-Header und keine öffentlichen Hostnamen.

Wenn NGINX auf derselben VM läuft, verwende in deinem HTTPS-vHost (Zertifikat und DNS wie gewohnt) einen location / Block mit den Direktiven aus deploy/nginx-location.conf. NGINX soll den öffentlichen Host einschließlich ggf. abweichendem Port erhalten, X-Forwarded-Proto mit dem tatsächlichen Schema und X-Real-IP mit der tatsächlichen Client-IP überschreiben. Verwende nicht vom Client übernommene Forwarding-Werte. Kein Pfadpräfix: die App wird unter / betrieben. Proxy-Buffering und Cache sind aus, damit Live-Synchronisierung (SSE) und private Antworten korrekt funktionieren. Upload-Limit 6 MiB, Timeout 180 Sekunden.

    sudo nginx -t
    sudo systemctl reload nginx

Bei NGINX auf einem anderen Rechner kann ein verschlüsselter SSH-Tunnel von diesem Rechner zur Shopping-VM den lokalen Proxy-Anschluss erreichbar machen:

    ssh -N -L 127.0.0.1:3001:127.0.0.1:3001 BENUTZER@SHOPPING-VM-IP

Dann zeigt auch dort proxy_pass auf http://127.0.0.1:3001. Für Dauerbetrieb den Tunnel mit eingeschränktem SSH-Schlüssel und Dienstverwaltung betreiben. Bei NGINX Proxy Manager im Container muss der Upstream aus dessen Netzwerk erreichbar sein; bei gleichem Docker-Host kann ein dediziertes gemeinsames Docker-Netz verwendet werden (Upstream shopping:3001), ausschließlich vertrauenswürdige Container anschließen. Bei getrennten Hosts den Tunnel bzw. ein isoliertes privates Proxy-Netz nutzen. Niemals den vertrauenswürdigen Port 3001 frei im LAN oder Internet veröffentlichen.

## Zwei separate VMs (ohne SSH-Tunnel)

Beispiel: Shopping-VM 192.168.0.150, NGINX-VM 192.168.0.66, DNS list.xc.local.
Auf der Shopping-VM `cp deploy/compose.remote-proxy.example.yaml compose.remote-proxy.yaml` und bei Bedarf IP-Adressen im lokalen Override anpassen (nicht in .env). Das Override ersetzt die Portliste und erlaubt weiter den direkten Host-Port 3000. Port 3001 wird ausschließlich auf der privaten Shopping-IP veröffentlicht. Der Server akzeptiert auf Port 3001 nur TCP-Verbindungen von der fest eingetragenen NGINX-IP; gefälschte Forwarded-Header können diese Prüfung nicht umgehen. Die Linux-Docker-Bridge muss die tatsächliche Quell-IP erhalten; bei NAT, die die Quell-IP ersetzt, scheitert die Verbindung absichtlich.

Vor Veröffentlichung von Port 3001 auf der Shopping-VM in der Proxmox-/Netzwerkfirewall TCP 3001 nur von 192.168.0.66/32 zulassen und für alle anderen Quellen sperren. TCP 3000 auf das vertrauenswürdige LAN begrenzen. Bestehende SSH-Regeln erhalten; keine Internet-Portfreigabe. Docker-Portpublishing kann gewöhnliche Host-UFW-Regeln umgehen, daher Proxmox-/Netzwerkfirewall nutzen. Danach starten:

    docker compose -f compose.yaml -f compose.remote-proxy.yaml up -d --build

DNS: list.xc.local A 192.168.0.66 (nicht Shopping-IP). .local ist für mDNS reserviert; wenn die Namensauflösung auf Geräten nicht zuverlässig funktioniert, besser list.xc.home.arpa verwenden. NGINX-vHost: siehe deploy/nginx-remote.example.conf. Festen Hostnamen an tatsächliche Domain anpassen; TLS optional mit einem auf den Clients vertrauenswürdigen lokalen Zertifikat. Für HTTPS den entsprechenden TLS-vHost verwenden und ebenfalls die tatsächliche $scheme weitergeben. Der HTTP-vHost ist nur für Tests gedacht. Beide URLs verwenden dieselbe Datenbank; ggf. getrennt anmelden.

Verifikation: auf NGINX-VM `curl -i -H 'Host: list.xc.local' -H 'X-Forwarded-Proto: http' http://192.168.0.150:3001/api/v1/health` (200 erwartet). Auf einem anderen LAN-Gerät muss derselbe Zugriff blockiert werden (Timeout/403); direkt über Port 3000 muss er funktionieren. Für spätere Compose-Befehle immer beide -f Optionen verwenden oder das Override bewusst als compose.override.yaml ablegen (automatisch geladen; nicht committen).

## Authentifizierung

HTTP verwendet das bisherige HTTP-only SameSite=Lax Cookie. HTTPS verwendet ein eigenständiges __Host-shopping_session Cookie mit Secure, HttpOnly und SameSite=Lax. Beim ersten HTTPS-Zugriff ggf. erneut anmelden. Alle schreibenden API-Anfragen werden gegen die vom Server ermittelte Origin geprüft, nicht gegen den Origin-Header allein. Die Proxy-Header werden nur am geschützten Proxy-Port ausgewertet. Keine CORS-Freigabe, kein Entfernen der CSRF-Prüfung.

## Test

1. SQLite-Backup erstellen und außerhalb der VM aufbewahren.
2. Testbranch feature/automatic-network-access auschecken und Docker Compose neu bauen.
3. Zugriff über private VM-IP und Port; Login, Eintrag erstellen und auf zweitem Gerät Live-Update prüfen.
4. Optional HTTPS-vHost konfigurieren und dieselben Funktionen prüfen. Kein Ändern der .env für den Host oder die Domain nötig.
5. Bei Bedarf HTTP-Port am Netzwerk einschränken. Die Anwendung ist weiterhin für privaten Heimnetz-Einsatz vorgesehen.
