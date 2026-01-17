![MLCRemote](screenshots/hero.jpg)

<div align="center">
  <h3>Access Any System, Anywhere.</h3>
  <p>
    <b>The All-in-One open-source Remote Development environment.</b><br>
    Connect to Linux, Windows, or Mac from a native desktop application.<br>
    No complex setup. No monthly fees. Just code.
  </p>
  <p>
    <a href="https://github.com/mlechner911/mlcremote/releases"><b>Download for Windows</b></a> • 
    <a href="docs/USER_GUIDE_EN.md">User Guide</a> • 
    <a href="CONTRIBUTING.md">Developer Guide</a>
  </p>
  <br>
</div>

**Status:** Production Ready (v1.3.0)

## Why MLCRemote?

We believe remote management should be **visual, fast, and free**.
Most remote tools are either expensive SaaS subscriptions or complex command-line utilities.

**MLCRemote** bridges this gap:
*   **Open Source (MIT):** Free to use for personal and commercial projects.
*   **Zero-Setup:** It deploys itself. You just need SSH access.
*   **Cross-Platform:** Connect *from* Windows/Mac/Linux *to* Windows/Mac/Linux.

## Features at a Glance

|   |   |
|---|---|
| **🚀 Instant Access** | Connect to any server in seconds. The app automatically deploys a lightweight, static Go binary to handle all operations. |
| **📁 Rich File Manager** | Drag & Drop uploads, context menus, trash support, and full file operations (Copy/Move/Delete). |
| **💻 Terminal & PTY** | Integrated, resize-aware SSH terminal with multiple tabs and full encoding support. |
| **🖼️ Media Preview** | View images, PDFs, Markdown, Videos, and Code directly in the remote file manager. |
| **🔒 Secure Tunneling** | All traffic flows through a secure SSH tunnel. No extra ports need to be opened on your firewall. |
| **⚡ Smart Tools** | Quick Jobs for one-click scripts, persistent workspace state, split-view editing, and more. |

## Documentation

- 📘 [User Guide (English)](docs/USER_GUIDE_EN.md)
- 📙 [Benutzerhandbuch (Deutsch)](docs/USER_GUIDE_DE.md)
- 🛠️ [Developer Guide (Contributing)](CONTRIBUTING.md)

## Screenshots

<p align="center">
  <img src="screenshots/startup_light.png" width="45%" alt="Connection Screen Light">
  <img src="screenshots/startup_dark.png" width="45%" alt="Connection Screen Dark">
</p>
<p align="center">
  <img src="screenshots/example.png" width="45%" alt="File Editor">
  <img src="screenshots/image_preview.png" width="45%" alt="Image Preview">
</p>

## Quick Start (Windows)

1.  **Download** the latest installer (`MLCRemote-setup.exe`) from [Releases](https://github.com/mlechner911/mlcremote/releases).
2.  **Run** the installer.
3.  **Connect**: Enter your Host IP and User.
    *   *Tip: Use "Managed Identity" for a seamless, password-less experience.*

That's it. The app handles the rest.

## Security

MLCRemote prioritizes security:
*   **Zero-Trust:** We don't store your passwords.
*   **Managed Keys:** We generate standard Ed25519 keys stored in your OS's secure profile.
*   **Sandboxed:** The remote agent runs as a standard user process.

See [SSH Security Setup](docs/SSH_SECURITY_SETUP.md) for hardening guides.

## License

MIT © Michael Lechner.

Free and Open Source Software. You can use, modify, and distribute this software freely.


