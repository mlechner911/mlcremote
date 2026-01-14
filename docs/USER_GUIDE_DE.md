# MLCRemote Benutzerhandbuch

Willkommen beim **MLCRemote** Benutzerhandbuch. Dieses Dokument enthält alle Informationen zur Installation, Konfiguration und Nutzung von MLCRemote für Ihre Remote-Entwicklungsabläufe.

## Inhaltsverzeichnis
1. [Einführung](#einführung)
2. [Installation](#installation)
3. [Erste Schritte](#erste-schritte)
   - [Verbindung herstellen](#verbindung-herstellen)
   - [Authentifizierungsmethoden](#authentifizierungsmethoden)
4. [Funktionen](#funktionen)
   - [Datei-Explorer](#datei-explorer)
   - [Integriertes Terminal](#integriertes-terminal)
   - [Profilverwaltung](#profilverwaltung)
   - [Geteilte Ansicht](#geteilte-ansicht)
5. [Fehlerbehebung](#fehlerbehebung)
6. [FAQ (Häufig gestellte Fragen)](#faq-häufig-gestellte-fragen)

---

## Einführung

**MLCRemote** ist eine leichtgewichtige, native Desktop-Anwendung, die speziell für **Systemadministratoren** und **DevOps Engineers** entwickelt wurde. Sie vereinfacht die Verwaltung von Remote-Servern, indem sie einen schnellen Editor in ein natives Fenster verpackt – ideal für schnelle Konfigurationsänderungen, Protokollanalysen und Systemupdates.

**Hauptvorteile:**
- **Keine Einrichtung**: Keine manuelle Installation auf dem Server erforderlich.
- **Sicher**: Der gesamte Datenverkehr wird über SSH-Tunnel verschlüsselt.
- **Native Erfahrung**: Schnelle, reaktionsfähige Desktop-Benutzeroberfläche mit Betriebssystemintegration.
- **Admin-Fokussiert**: Ideal zum Bearbeiten von `/etc/` Konfigurationsdateien, Überprüfen von `systemd`-Logs oder Ausführen von Wartungsskripten.

## Release Notes (v1.2.1)
- **Behoben**: Ein Problem wurde gelöst, bei dem Remote-Prozesse (z.B. `btop`) als Zombie-Prozesse weiterliefen, nachdem die Sitzung beendet wurde. Das System beendet nun korrekt die gesamte Prozessgruppe.
- **Behoben**: Drag-and-Drop Datei-Upload in der Seitenleiste wiederhergestellt.
- **Behoben**: "Kopieren/Einfügen" Text-Buttons im Terminal durch Icons ersetzt.

## Installation

### Windows
1. Laden Sie die neueste `MLCRemote-Windows-x64.zip` von der Releases-Seite herunter.
2. Extrahieren Sie den Inhalt in einen Ordner Ihrer Wahl (z. B. `C:\Programme\MLCRemote`).
3. Doppelklicken Sie auf `MLCRemote.exe`, um die Anwendung zu starten.
   > **Hinweis**: Möglicherweise sehen Sie eine SmartScreen-Warnung. Sie können diese sicher ignorieren, indem Sie auf "Weitere Informationen" -> "Trotzdem ausführen" klicken (da die Binärdatei nicht signiert ist).

### macOS / Linux
Derzeit muss MLCRemote für diese Plattformen aus dem Quellcode kompiliert werden.
1. Stellen Sie sicher, dass Go 1.21+ und Node.js 18+ installiert sind.
2. Klonen Sie das Repository und führen Sie aus:
   ```bash
   make debug
   ```
   ```
   *Offizielle Binärdateien für macOS und Linux werden bald verfügbar sein.*

   **Wichtig für Linux/WSL Benutzer**:
   Wenn Sie Darstellungsprobleme haben (z. B. Text wird als Kästchen angezeigt oder fehlende Cursor), stellen Sie bitte sicher, dass die Standard-Schriftarten installiert sind:
   ```bash
   sudo apt install fonts-noto fonts-liberation fontconfig
   ```

---

## Erste Schritte

### Verbindung herstellen

Wenn Sie MLCRemote zum ersten Mal starten, sehen Sie den **Startbildschirm**.

1. Klicken Sie in der Seitenleiste auf die Schaltfläche **Neue Verbindung** (+).
2. Geben Sie die Verbindungsdetails ein:
   - **Name**: Ein freundlicher Name für diesen Server (z. B. "Produktions-VPS").
   - **Host**: Die IP-Adresse oder der Domänenname (z. B. `192.168.1.50`).
   - **Benutzer**: Der SSH-Benutzername (z. B. `root` oder `ubuntu`).
   - **Port**: SSH-Port (Standard: `22`).
3. (Optional) Wählen Sie eine **Farbe**, um dieses Profil leichter identifizieren zu können.
4. Klicken Sie auf **Speichern**.
5. Wählen Sie das Profil aus der Liste aus und klicken Sie auf **Verbinden**.

Die Anwendung wird:
1. Eine sichere SSH-Verbindung herstellen.
2. Prüfen, ob das MLCRemote-Backend auf dem Server installiert ist.
3. Das Backend automatisch bereitstellen/aktualisieren, falls erforderlich.
4. Die Remote-Umgebung öffnen.

### Sitzungsverwaltung

Wenn MLCRemote eine bestehende Backend-Sitzung auf dem Server erkennt, werden Ihnen folgende Optionen angeboten:

*   **Sitzung beitreten** (Join Session): Verbinden Sie sich mit der laufenden Sitzung. Nützlich, wenn Sie die App versehentlich geschlossen haben.
*   **Sitzung neu starten** (Restart Session): Beendet das bestehende Backend und startet ein neues. Verwenden Sie dies, wenn das Backend nicht reagiert.
*   **Neue Instanz starten** (Start New Instance): Startet eine *parallele* Backend-Instanz auf einem anderen Port. Verwenden Sie dies, um mehrere unabhängige Sitzungen gleichzeitig auf demselben Server auszuführen.

**Sitzung teilen (Token Sharing)**:
Sobald Sie verbunden sind, können Sie auf die Schaltfläche **Sitzung teilen** (Schlüssel-Symbol) in der oberen Kopfzeile klicken, um das sichere Sitzungstoken zu kopieren. Sie können dieses Token mit Kollegen teilen, die SSH-Zugriff auf den Server haben, damit diese sich mit Ihrer Sitzung verbinden können.

### Authentifizierungsmethoden

MLCRemote unterstützt drei primäre Authentifizierungsmethoden:

1.  **Verwaltete Identität (Premium)**:
    *   Die sicherste und bequemste Option. MLCRemote generiert und verwaltet einen dedizierten Ed25519 SSH-Schlüssel für Sie.
    *   **Einrichtung**: Geben Sie Ihr Passwort einmal ein, und die App konfiguriert den Server automatisch für den passwortlosen Zugriff.
    *   **Indikator**: Ein blaues "Managed"-Abzeichen erscheint auf dem Startbildschirm für diese Verbindungen.

2.  **System-Agent / Standard**:
    *   Verwendet Ihren System-SSH-Agenten oder Standardspeicherorte für Schlüssel (z. B. `~/.ssh/id_rsa`, `~/.ssh/id_ed25519`).
    *   Empfohlen, wenn Sie bereits SSH-Schlüssel konfiguriert haben.

3.  **Benutzerdefinierte Schlüsseldatei**:
    *   Wählen Sie eine bestimmte private Schlüsseldatei (`.pem`, `id_rsa`, usw.) von Ihrem Computer aus.

4.  **Passwort-Fallback**:
    *   Wenn die Schlüsselauthentifizierung fehlschlägt oder nicht konfiguriert ist, werden Sie nach dem SSH-Passwort gefragt.
    *   **Feature**: Sie können direkt über die Passworteingabe auf eine Verwaltete Identität upgraden oder Ihren lokalen Schlüssel bereitstellen.

---

## Funktionen

### Datei-Explorer
Der **Datei-Explorer** (linke Leiste) ermöglicht Ihnen die Verwaltung von Remote-Dateien.
- **Navigation**: Klicken Sie auf Ordner, um zu navigieren. Verwenden Sie die Brotkrumen navigation (Breadcrumbs) oben, um zurückzuspringen.
- **Bearbeiten**: Klicken Sie auf eine Datei, um sie im Editor zu öffnen.
- **Kontextmenü**: Rechtsklick auf ein Element für weitere Optionen:
  - **Herunterladen**: Speichern Sie die Datei auf Ihrem lokalen Computer.
  - **Pfad kopieren**: Kopieren Sie den vollständigen Remote-Pfad.
  - **Löschen**: Datei/Ordner entfernen (in den Papierkorb verschoben).
- **Hochladen**: Ziehen Sie Dateien von Ihrem Computer in den Explorer-Bereich (Drag & Drop), um sie hochzuladen.

### Integriertes Terminal
Greifen Sie direkt auf die Kommandozeile des Servers zu.
- **Tabs**: Öffnen Sie mehrere Terminal-Tabs für verschiedene Aufgaben.
- **Größenänderung**: Das Terminal passt sich automatisch an die Fenstergröße an.
- **Kopieren/Einfügen**: Standard-Shortcuts (`Strg+Umschalt+C/V` oder `Befehl+C/V`) und UI-Schaltflächen werden unterstützt.

### Profilverwaltung
- **Metadaten**: Die App erkennt und speichert automatisch das Remote-Betriebssystem (z. B. "Ubuntu 22.04") und den Zeitpunkt der letzten Verbindung.
- **Sortierung**: Profile werden automatisch nach "Zuletzt verwendet" sortiert.
- **Bearbeiten/Löschen**: Verwenden Sie die Symbole in der Seitenleiste, um Ihre gespeicherten Profile zu verwalten.

### Tabs und Geteilte Ansicht (Split View)
Steigern Sie die Produktivität, indem Sie Dateien und Terminals nebeneinander anzeigen.

- **Tabs**: Öffnen Sie mehrere Dateien gleichzeitig. Ziehen Sie Tabs, um sie neu anzuordnen.
- **Geteilte Ansicht**: Rechtsklick auf einen Tab und wählen Sie **Rechts teilen** (Split Right) oder **Unten teilen** (Split Down), um einen neuen Bereich zu erstellen.
- **Größenänderung**: Ziehen Sie die Teiler zwischen den Bereichen, um deren Größe anzupassen.
- **Kontextmenü**: Rechtsklick auf Tabs für Optionen wie "Andere schließen", "Nach rechts schließen", usw.

### Aktivitätsleiste (Activity Bar)
Die schmale Leiste ganz links bietet schnellen Zugriff auf wichtige Funktionen:

- **Datei-Explorer**: Standardansicht für Ihre Remote-Dateien.
- **Schnellaufgaben (Quick Tasks)**: Starten Sie häufig verwendete Befehle mit einem einzigen Klick.
- **Neues Terminal**: Öffnet sofort ein neues SSH-Terminal.
- **Papierkorb**: Zugriff auf gelöschte Remote-Dateien.
- **Einstellungen**: Konfiguration von App-Einstellungen und Profilen.

#### Konfiguration der Schnellaufgaben
Sie können häufige Befehle in einer `tasks.json` im Datei-Explorer definieren oder über die Einstellungen hinzufügen. Hier einige Beispiele:

```json
[
  {
    "name": "Session Manager",
    "command": "tmux attach || tmux new",
    "icon": "server",
    "color": "#00ff00"
  },
  {
    "name": "SQL Backup",
    "command": "mysqldump -u root -p my_db > backup.sql && echo 'Backup fertig!'",
    "icon": "database",
    "color": "#ff0000"
  },
  {
    "name": "System Status",
    "command": "htop",
    "icon": "chart-bar",
    "color": "#0099ff"
  }
]
```

---

## Fehlerbehebung

### "Verbindung abgelehnt" (Connection Refused)
- Stellen Sie sicher, dass der Server online ist.
- Überprüfen Sie, ob der SSH-Port korrekt ist (Standard 22).
- Überprüfen Sie Ihre lokalen Firewall-Einstellungen.

### "Agent-Bereitstellung fehlgeschlagen" (Agent Deployment Failed)
- Stellen Sie sicher, dass der Benutzer Schreibrechte für sein Home-Verzeichnis (`~/`) hat.
- Wenn auf dem Server nur wenig Speicherplatz frei ist, geben Sie etwas Platz frei.
- Windows-Server: Stellen Sie sicher, dass PowerShell verfügbar ist.

### "WebSocket-Fehler"
- Stellen Sie sicher, dass Sie die neueste Version der Desktop-App verwenden.
- Dies deutet oft auf eine Versionsinkompatibilität zwischen der lokalen App und dem Remote-Backend hin. Die App sollte das Backend automatisch aktualisieren, aber Sie können dies erzwingen, indem Sie `~/.mlcremote` auf dem Server löschen.

---

## FAQ (Häufig gestellte Fragen)

**F: Wird mein Master-Passwort an den Server gesendet?**
A: **Nein.** Die App-Sperre (Master-Passwort) dient rein lokal zur Verschlüsselung Ihrer Verbindungsprofile auf Ihrem Computer.

**F: Wo werden meine Profile gespeichert?**
A: Nur auf Ihrem lokalen Computer im Anwendungsdatenverzeichnis.

**F: Können mehrere Benutzer eine Verbindung zum selben Server herstellen?**
A: **Ja.** MLCRemote unterstützt jetzt Mehrbenutzersitzungen mit sicherer Token-Authentifizierung.

**F: Kann ich mehrere Instanzen von MLCRemote ausführen?**
A: **Ja.** Sie können mehrere Fenster öffnen (indem Sie die App mehrmals starten), um sich gleichzeitig mit verschiedenen Servern oder demselben Server zu verbinden. Jede Instanz verwendet ihren eigenen sicheren, konfliktfreien Tunnel.

**F: Warum werde ich nach meinem Passwort gefragt?**
A: MLCRemote bittet Sie **nur einmal** pro neuem Server um Ihr SSH-Passwort, um Ihren öffentlichen Schlüssel oder Ihre verwaltete Identität sicher zu installieren. Nachfolgende Verbindungen erfolgen ohne Passworteingabe. Wir speichern Ihr SSH-Passwort nicht.
