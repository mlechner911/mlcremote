package ssh

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf16"

	"golang.org/x/crypto/ssh"
)

// ProbePublicKey attempts to connect via SSH using the specified identity file.
// Returns "ok", "auth-failed", "no-key", or a detailed error description.
func (m *Manager) ProbePublicKey(host string, user string, port int, identityFile string) (string, error) {
	fmt.Printf("[DEBUG] ProbePublicKey: host=%s user=%s identity=%s\n", host, user, identityFile)
	if identityFile == "" {
		identityFile = m.FindDefaultIdentity()
		fmt.Printf("[DEBUG] ProbePublicKey: Found default identity: %s\n", identityFile)
	}

	if identityFile == "" {
		fmt.Println("[DEBUG] ProbePublicKey: No identity found")
		return "no-key", nil
	}

	keyData, err := os.ReadFile(identityFile)
	if err != nil {
		if os.IsNotExist(err) {
			return "key-not-found", nil
		}
		return "key-error", fmt.Errorf("failed to read key: %w", err)
	}

	signer, err := ssh.ParsePrivateKey(keyData)
	if err != nil {
		return "key-invalid", fmt.Errorf("failed to parse private key: %w", err)
	}

	config := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeys(signer),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		// Differentiate between network error and auth error
		// This is tricky with Go's SSH lib, as it returns a generic error string for auth failures
		errStr := err.Error()
		fmt.Printf("[DEBUG] ProbePublicKey: Dial failed (err=%s). Auth error? %v\n", errStr, containsAuthError(errStr))
		if containsAuthError(errStr) {
			return "auth-failed", nil
		}
		return "unreachable", err
	}
	defer client.Close()
	fmt.Println("[DEBUG] ProbePublicKey: Success")

	return "ok", nil
}

func containsAuthError(err string) bool {
	// Common SSH auth error messages
	return strings.Contains(err, "unable to authenticate")
}

// FindDefaultIdentity looks for common SSH keys (RSA, Ed25519) in the user's .ssh directory.
// It returns the path to the first valid key found, or an empty string if none exist.
func (m *Manager) FindDefaultIdentity() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}

	// Check rsa
	rsa := filepath.Join(home, ".ssh", "id_rsa")
	if _, err := os.Stat(rsa); err == nil {
		return rsa
	}

	// Check ed25519
	ed := filepath.Join(home, ".ssh", "id_ed25519")
	if _, err := os.Stat(ed); err == nil {
		return ed
	}

	return ""
}

// VerifyPassword checks if the password is valid for the given host
func (m *Manager) VerifyPassword(host string, user string, port int, password string) (string, error) {
	config := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return "auth-failed", err
	}
	defer client.Close()

	return "ok", nil
}

// DeployPublicKey connects via password and adds the local public key to authorized_keys
func (m *Manager) DeployPublicKey(host string, user string, port int, password string, identityFile string) error {
	fmt.Printf("[DEBUG] DeployPublicKey: host=%s user=%s identity=%s\n", host, user, identityFile)
	if identityFile == "" {
		identityFile = m.FindDefaultIdentity()
		fmt.Printf("[DEBUG] DeployPublicKey: Found default identity: %s\n", identityFile)
	}
	if identityFile == "" {
		// Fallback to id_rsa if nothing found, though this shouldn't happen in this flow usually
		home, _ := os.UserHomeDir()
		identityFile = filepath.Join(home, ".ssh", "id_rsa")
		fmt.Printf("[DEBUG] DeployPublicKey: No default found, falling back to: %s\n", identityFile)
	}

	pubKeyPath := identityFile + ".pub"
	pubKeyData, err := ioutil.ReadFile(pubKeyPath)
	if err != nil {
		fmt.Printf("[DEBUG] DeployPublicKey: Failed to read pubkey: %v\n", err)
		return fmt.Errorf("failed to read public key %s: %w", pubKeyPath, err)
	}

	// Trim whitespace to avoid issues
	pubKeyStr := strings.TrimSpace(string(pubKeyData))
	if pubKeyStr == "" {
		return fmt.Errorf("public key file is empty")
	}

	config := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		fmt.Printf("[DEBUG] DeployPublicKey: SSH Dial failed: %v\n", err)
		return fmt.Errorf("failed to connect via password: %w", err)
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	// Ensure ~/.ssh exists, fix permissions, and safely append the key ensuring a newline separator
	// We use single quotes to wrap the key, which protects against most shell expansions ($...)
	// We must escape existing single quotes in the key (rare but possible in comments)
	safeKey := strings.ReplaceAll(pubKeyStr, "'", "'\\''")

	// Simplified command: check dir -> append key -> fix perms
	// Linux/Mac implementation
	linuxCmd := fmt.Sprintf("mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '%s' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys", safeKey)

	fmt.Printf("[DEBUG] DeployPublicKey: Running command on remote...\n")
	output, err := session.CombinedOutput(linuxCmd)
	if err != nil {
		fmt.Printf("[DEBUG] DeployPublicKey: Linux command failed: %v. Output: %s\n", err, strings.TrimSpace(string(output)))
		fmt.Println("[DEBUG] DeployPublicKey: Attempting Windows fallback...")

		// Windows/PowerShell implementation (Robust Base64 EncodedCommand)
		// We use the raw key and escape single quotes for PowerShell (which is '')
		psKey := strings.ReplaceAll(pubKeyStr, "'", "''")

		// PowerShell Script to securely create/append key and set strictly defined ACLs (User/Admin/System only)
		// We use .NET classes for ACLs to avoid "icacls" localization/parsing issues.
		script := fmt.Sprintf(`
$k = '%s'
$d = "$env:USERPROFILE\.ssh"
$f = "$d\authorized_keys"
if (!(Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
Add-Content -Force -Path $f -Value $k -Encoding Ascii

# Fix ACLs using .NET
$a = Get-Acl $f
# Disable inheritance, remove existing rules
$a.SetAccessRuleProtection($true, $false)

# Add Current User
$id = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$a.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($id, "FullControl", "Allow")))

# Add Administrators (SID: S-1-5-32-544)
$ad = New-Object System.Security.Principal.SecurityIdentifier("S-1-5-32-544")
$a.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($ad, "FullControl", "Allow")))

# Add System (SID: S-1-5-18)
$sy = New-Object System.Security.Principal.SecurityIdentifier("S-1-5-18")
$a.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($sy, "FullControl", "Allow")))

Set-Acl $f $a
Write-Host "Key deployed and secured."
`, psKey)

		// Encode Script to UTF-16LE Base64 for -EncodedCommand
		u16 := utf16.Encode([]rune(script))
		buf := new(bytes.Buffer)
		for _, v := range u16 {
			binary.Write(buf, binary.LittleEndian, v)
		}
		b64Cmd := base64.StdEncoding.EncodeToString(buf.Bytes())

		// Create session for Windows fallback
		sessionWin, errWin := client.NewSession()
		if errWin != nil {
			return fmt.Errorf("failed to create fallback session: %w", errWin)
		}
		defer sessionWin.Close()

		winCmd := fmt.Sprintf("powershell -EncodedCommand %s", b64Cmd)
		outputWin, errWinCmd := sessionWin.CombinedOutput(winCmd)
		if errWinCmd != nil {
			return fmt.Errorf("failed to install public key (Windows Fallback): %v. Output: %s", errWinCmd, strings.TrimSpace(string(outputWin)))
		}

		fmt.Printf("[DEBUG] DeployPublicKey: Windows fallback success. Output: %s\n", string(outputWin))
		return nil
	}

	fmt.Printf("[DEBUG] DeployPublicKey: Success. Output: %s\n", string(output))
	return nil
}
