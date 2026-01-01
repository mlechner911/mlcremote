# Release Information

This folder contains pre-built binaries for MLCRemote.

### ⚠️ Security Note / Antivirus Warnings

Because this application embeds tools for **SSH tunneling**, **remote process execution**, and **port forwarding**, some antivirus software (e.g., Windows Defender) might flag it as potentially unwanted or malicious (False Positive).

This is expected behavior for tools that perform these network operations.

**If you are worried about security:**
Please **build from source** using the instructions in the main [README](../README.md). This ensures you are running exactly what is in the codebase.

```powershell
cd desktop/wails
wails build
```
