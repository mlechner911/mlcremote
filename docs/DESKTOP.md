**Desktop Flow**

Dieses Dokument beschreibt den vorgesehenen Ablauf der Desktop-Anwendung (Wails EXE), wie der SSH-Tunnel aufgebaut wird, wie die Health-Check-Logik funktioniert und wie das Remote-Frontend im gleichen Fenster angezeigt wird.

**Kurzüberblick:**
- **Zweifaches Frontend:** Die EXE beinhaltet das lokale Connect/Settings-Frontend ("Hello/Connect UI") und lädt das Remote-Frontend erst, wenn eine SSH-Weiterleitung (Local Forward) zu einem entfernten Host erfolgreich steht.
- **Ablauf:** Start → Connect-Formular → SSH-Tunnel starten → Health-Check über Tunnel → wenn OK: navigiere im selben Fenster zur lokalen Forward-URL (z. B. `http://127.0.0.1:8443`).

**Details — Komponenten**
- **Desktop EXE (Wails):** Enthält das lokale UI (React/Vite `dist/`) und Go-APIs, die vom Frontend aufgerufen werden: `StartTunnelWithProfile`, `StopTunnel`, `TunnelStatus`, `HealthCheck`.
- **Connect/Hello UI:** Kleines Formular zum Erfassen des `TunnelProfile` (User, Host, LocalPort, RemoteHost, RemotePort, IdentityFile, ExtraArgs). Das Formular ruft `StartTunnelWithProfile(profileJSON)` auf.
- **SSH Tunnel (lokal):** Go startet einen `ssh -L<localPort>:<remoteHost>:<remotePort> user@host` Prozess mit `-o ExitOnForwardFailure=yes -N` (kein Remote-Shell). Dieser Prozess bindet an `127.0.0.1:<localPort>` lokal.

**Details — Ablauf (Sequenz)**
1. App starten: Die EXE zeigt die lokale Hello/Connect UI. Das Remote-Frontend ist zu diesem Zeitpunkt nicht geladen.
2. Benutzer füllt `Connect` aus und klickt "Connect": Frontend serialisiert `TunnelProfile` als JSON und ruft `StartTunnelWithProfile(profileJSON)` auf (Wails binding).
3. `StartTunnelWithProfile` in Go:
   - Prüft, ob `ssh` im PATH verfügbar ist.
   - Prüft (falls angegeben), dass die `IdentityFile` lesbar ist.
   - Prüft, ob `LocalPort` frei ist (versucht `net.Listen("127.0.0.1:<port>")` und schließt sofort).
   - Baut das `ssh` Kommando und startet den Prozess (`cmd.Start()`), setzt internen Status `starting`.
   - Startet einen Hintergrund-Goroutine, der zwei Dinge macht:
     - Wartet (asynchron) auf das Ende des SSH-Prozesses (falls er vorher beendet wird → `stopped`).
     - Pollt periodisch `http://127.0.0.1:<localPort>/health` (Timeout ~15s). Wenn die Health-URL mit HTTP 200 antwortet, ruft Go `runtime.EventsEmit(ctx, "navigate", localURL)` auf und setzt internen Status `started`.
4. Frontend: Es registriert beim Start (nur in der Desktop/EXE-Umgebung) einen Wails-Event-Listener `EventsOn('navigate', handler)`. Sobald das `navigate` Event ankommt, führt der Handler `window.location.href = url` aus (Navigation im selben Fenster). Dadurch wird das Remote-Frontend geladen und angezeigt.

**Warum diese Lösung?**
- Die EXE bleibt schlank und enthält nur das lokale Management-UI. Die Remote-UI bleibt auf dem Remote-Server und wird zur Laufzeit via SSH-Tunnel zugänglich gemacht.
- Vor dem Navigieren stellen wir sicher, dass der Remote-Backend-Service wirklich erreichbar ist (Health-Check). Das verhindert, dass die WebView auf eine noch nicht gebundene Port-Weiterleitung zeigt.

**Fehlerfälle / Randbedingungen**
- `ssh` nicht im PATH: `StartTunnelWithProfile` gibt einen erklärenden Fehler zurück, den das Frontend anzeigt.
- `IdentityFile` nicht lesbar: Fehler zurückgeben und nicht starten.
- `LocalPort` in Benutzung: `StartTunnelWithProfile` meldet `local port unavailable`.
- Tunnel-Prozess beendet sich vor Health-Check-Erfolg: Status `stopped` und Event wird nicht gesendet.
- Health-Check Timeout (z. B. 15s): Wir gehen davon aus, dass der Tunnel steht, aber der Remote-Service nicht korrekt startet; die App setzt `started` Zustand, aber kein `navigate` Event — Frontend sollte Rückmeldung geben und ggf. `HealthCheck` manuell anstoßen.

**UX-/Implementationshinweise**
- `ConnectDialog` sollte während `starting`/`started` Zuständen UI-Feedback zeigen (Spinner, Disable Buttons) und eine `Stop`-Schaltfläche anbieten, die `StopTunnel()` aufruft.
- Optional kann `StartTunnelWithProfile` (oder eine zusätzliche API) stdout/stderr des ssh-Prozesses streamen, damit der Benutzer Logs sehen kann.
- Optionaler Modus: Statt Laufzeit-Laden über Tunnel können Remote-Assets vorab gebaut und in die EXE gebündelt werden. Das ist eine andere Betriebsart (keine Laufzeit-Abhängigkeit vom Tunnel), benötigt aber, dass man Remote-Builds synchronisiert und in die Wails `dist/` kopiert.

**Build & Test (Kurz)**
- Desktop-Frontend bauen (erzeugt `dist/` mit Desktop entry):
  ```bash
  cd desktop/wails/appfrontend
  npm run build:desktop
  ```
- Wails/EXE bauen (aus `desktop/wails`):
  ```bash
  cd desktop/wails
  wails build
  ```
- Lokaler Test: Startet die EXE, fülle Connect-Formular, starte Tunnel. Alternativ kann man beim Entwickeln die Wails-Dev-Workflow nutzen und das Backend manuell starten.

**Deploy Frontend to Remote (quick)**
- Build frontend (desktop entry):
  ```bash
  cd desktop/wails/appfrontend
  npm run build:desktop
  ```
- Copy `dist/` to remote server (example using `rsync`):
  ```bash
  rsync -avz desktop/wails/appfrontend/dist/ user@remote:/opt/mlcremote/dist/
  ```
- Start backend on remote and point to static dir:
  ```bash
  ./lightdev --port 8443 --root /home/user/workdir --static-dir /opt/mlcremote/dist
  ```
- Test in browser or via SSH tunnel:
  ```bash
  ssh -L8443:127.0.0.1:8443 user@remote
  # then open http://127.0.0.1:8443
  ```

**Version / Compatibility check**
- The backend exposes `/api/version` returning a small JSON with `backend` and `frontendCompatible` hints. The desktop app should call this endpoint before navigating to ensure the remote UI is compatible with the backend API.
  ```js
  // example check
  const v = await fetch('http://127.0.0.1:8443/api/version').then(r=>r.json())
  if (!semver.satisfies(frontendVersion, v.frontendCompatible)) {
    throw new Error('incompatible frontend version')
  }
  ```

**Appendix — Empfohlene APIs (Wails Bindings)**
- `StartTunnelWithProfile(profileJSON string) (string, error)` — startet Tunnel und initialisiert Polling.
- `StopTunnel() (string, error)` — beendet Tunnel-Prozess (SIGTERM/KILL fallback).
- `TunnelStatus() string` — `starting|started|stopping|stopped`.
- `HealthCheck(url string, timeoutSeconds int) (string, error)` — prüft `/health` eines gegebenen URL.

Wenn du möchtest, schreibe ich noch ein kleines Sequenzdiagramm oder erweitere das Dokument um konkrete UI-Wireframes und Fehlermeldungen, die angezeigt werden sollen.

Desktop EXE (Wails) — Design and usage

This document describes the Wails prototype included in `desktop/wails` and the recommended behavior for the desktop EXE.

Goals
- Provide an easy-to-install desktop wrapper that manages SSH tunnels and connects to a remote MLCRemote server.
- Offer a per-profile Connect dialog and Settings dialog to manage connection profiles.
- Ensure the desktop app checks for a running backend before creating an SSH tunnel.

Prototype notes
- Location: `desktop/wails`
- The Go binding exposes `HealthCheck(url, timeoutSeconds)` which the frontend uses to validate the presence of the backend's `/health` endpoint.
- The frontend includes a simple Connect dialog and a Settings dialog storing profiles in `localStorage` (prototype only).

Connect flow (recommended)
1. User clicks Connect for a profile.
2. Desktop app attempts direct health check on `http://127.0.0.1:<localPort>/health`.
   - If successful: open the UI connected to that port.
   - If not successful and profile has `useTunnel=true`: prompt the user to start an SSH tunnel to `host:remotePort`. If confirmed:
     - Spawn `ssh -L <localPort>:localhost:<remotePort> user@host` as a child process and monitor it.
     - Wait briefly and re-run the health check on the local forwarded port.
     - If now healthy: proceed, otherwise show an error and allow retry.
3. The desktop app must manage the lifecycle of the spawned SSH process: stop it when the user disconnects or the app exits.

Security & UX considerations
- Never store private keys inside profile files. Allow a path to a key or rely on SSH agent.
- Use ephemeral local ports for tunnel endpoints to avoid port collisions.
- Show clear status and error messages when a tunnel fails.

Next steps to productionize
- Replace `localStorage` with OS-backed secure storage (Keychain / libsecret / Credential Manager).
- Add auto-updates and installers for target platforms.
- Add preference for running tunnels via an external terminal vs. managed background process.

