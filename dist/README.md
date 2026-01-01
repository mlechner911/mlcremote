# Release Information

This folder contains pre-built binaries for MLCRemote.

### Prerequisites

- **OpenSSH Client**: This app relies on the system's `ssh` command.
  - **Windows 10/11**: Usually installed by default.
  - If missing, install it via *Settings > Apps > Optional Features > Add a feature > OpenSSH Client*.

### ⚠️ Security Note / Antivirus Warnings

Because this application embeds tools for **SSH tunneling**, **remote process execution**, and **port forwarding**, some antivirus software (e.g., Windows Defender) might flag it as potentially unwanted or malicious (False Positive).

This is expected behavior for tools that perform these network operations.

**If you are worried about security:**
Please **build from source** using the instructions in the main [README](../README.md). This ensures you are running exactly what is in the codebase.

```powershell
cd desktop/wails
wails build
```
