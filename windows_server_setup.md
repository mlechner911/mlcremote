# Setting up a Windows Remote Server for MLCRemote

MLCRemote supports Windows 10/11 acting as the "Remote Server". This allows you to connect from another machine (e.g., your MacBook) and develop directly on your Windows storage.

## Prerequisites

*   Windows 10 (Version 1809 or later) or Windows 11.
*   Administrator access to the Windows machine.

## Step 1: Install OpenSSH Server

You can install it via Settings OR PowerShell.

### Method A: PowerShell (Fastest)

If you can't find it in Settings, run this in **Administrator PowerShell**:

```powershell
# Check if available
Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH*'

# Install Server
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
```

### Method B: Settings UI

1.  Open **Settings** > **Apps** > **Optional features** (or **System** > **Optional features** on Win 11).
2.  Click **Add a feature**.
3.  Search for **OpenSSH Server** and click **Install**.
4.  Wait for the installation to complete.

## Step 2: Start and Configure the SSH Service

By default, the service is installed but not running.

1.  Open **PowerShell** as Administrator.
2.  Run the following commands to start the service and ensure it runs on boot:

```powershell
# Start the SSHD service
Start-Service sshd

# Set startup type to Automatic
Set-Service -Name sshd -StartupType 'Automatic'

# Check status
Get-Service sshd
```

## Step 3: Firewall Configuration

The installation usually creates a firewall rule, but it's good to verify.

1.  In the Admin PowerShell, run:

```powershell
Get-NetFirewallRule -Name *ssh*
```

2.  If no rule exists (rare), create one:

```powershell
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
```

## Step 4: Authentication Setup (SSH Only)

**MLCRemote strictly enforces SSH Key authentication.** Password authentication is only supported for the initial key upload, but keys are preferred for stability.

### A. Set Default Shell (Optional but Recommended)
MLCRemote is compatible with the default Command Prompt (`cmd.exe`), as it explicitly invokes PowerShell when needed. You **do not** need to change the default shell to PowerShell, though many users prefer it.

### B. Add Your Public Key
On Windows, the `authorized_keys` file works similarly to Linux but has strict permission requirements.

1.  **Locate your user folder**: `C:\Users\YOUR_USERNAME\`
2.  **Create .ssh directory** (if missing):
    ```powershell
    mkdir C:\Users\YOUR_USERNAME\.ssh
    ```
3.  **Create authorized_keys file**:
    *   Create a text file named `authorized_keys` inside `.ssh`.
    *   Paste your public key (e.g., `id_ed25519.pub` content) into it.
    *   **Important**: Ensure the file has no extension (not `authorized_keys.txt`).

### C. Fix Permissions (Critical)
Windows OpenSSH is very strict. If permissions are too open, it will ignore your key.

Run this script in Admin PowerShell to fix permissions for your `.ssh` folder:

```powershell
$path = "C:\Users\YOUR_USERNAME\.ssh"
$acl = Get-Acl $path
$acl.SetAccessRuleProtection($true, $false)
$admins = New-Object System.Security.AccessControl.FileSystemAccessRule("Administrators","FullControl","Allow")
$system = New-Object System.Security.AccessControl.FileSystemAccessRule("SYSTEM","FullControl","Allow")
$user = New-Object System.Security.AccessControl.FileSystemAccessRule("$env:USERNAME","FullControl","Allow")
$acl.AddAccessRule($admins)
$acl.AddAccessRule($system)
$acl.AddAccessRule($user)
Set-Acl $path $acl
```

*Alternatively, restart the SSH service after creating the file; sometimes it fixes itself.*

## Step 5: Test Connection

From your local machine (where MLCRemote is installed):

1.  Open a terminal.
2.  Try to SSH manually first:
    ```bash
    ssh user@windows-ip
    ```
3.  If this works without a password (or prompts for key passphrase), MLCRemote will work.

## Troubleshooting

*   **"Connection Refused"**: Check if the `sshd` service is running (`Get-Service sshd`).
*   **"Permission Denied (publickey)"**: 99% of the time, this is due to bad permissions on `authorized_keys` or the file being named `.txt`.
*   **"The term 'ssh' is not recognized"**: Ensure you installed **OpenSSH Client** on your local machine.

## Using MLCRemote

Now simply open MLCRemote:
1.  **Host**: IP address of Windows machine.
2.  **User**: Windows username.
3.  **Identity File**: Path to your private key.
4.  **Connect**.

MLCRemote will automatically deploy the Windows-compatible agent and start the session.
