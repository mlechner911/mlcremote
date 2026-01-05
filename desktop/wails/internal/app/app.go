package app

import (
	"context"
	"fmt"
	"io/fs"
	"net/http"
	"time"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/backend"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/config"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context

	// Services
	Config  *config.Manager
	SSH     *ssh.Manager
	Backend *backend.Manager
}

// SSHDeployRequest contains credentials for SSH operations
type SSHDeployRequest struct {
	Host         string `json:"host"`
	User         string `json:"user"`
	Port         int    `json:"port"`
	Password     string `json:"password"`
	IdentityFile string `json:"identityFile"`
}

// NewApp creates a new App application struct
func NewApp(payload fs.FS) *App {
	return &App{
		Config:  config.NewManager(),
		SSH:     ssh.NewManager(),
		Backend: backend.NewManager(payload),
	}
}

// Startup is called at application startup
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	_, _ = a.Config.DeduplicateProfiles()
}

// Shutdown is called at application termination
func (a *App) Shutdown(ctx context.Context) {
	a.cleanup()
}

// BeforeClose is called when the user tries to close the window
func (a *App) BeforeClose(ctx context.Context) (prevent bool) {
	status := a.SSH.TunnelStatus()
	running := status == "connected" || status == "starting"

	if running {
		runtime.EventsEmit(ctx, "shutdown-initiated")
		go func() {
			// Give UI a moment to show "Disconnecting..."
			time.Sleep(500 * time.Millisecond)
			a.cleanup()
			runtime.Quit(ctx)
		}()
		return true // Prevent immediate close
	}
	return false // Allow close
}

func (a *App) cleanup() {
	fmt.Println("Gracefully stopping tunnel...")
	_, _ = a.SSH.StopTunnel()
}

// DeduplicateProfiles removes entries with identical User, Host, Port
func (a *App) DeduplicateProfiles() (int, error) {
	return a.Config.DeduplicateProfiles()
}

// DeploySSHKey installs the user's public key to the remote server using a password
func (a *App) DeploySSHKey(req SSHDeployRequest) error {
	return a.SSH.DeployPublicKey(req.Host, req.User, req.Port, req.Password, req.IdentityFile)
}

// ProbeConnection checks if the SSH connection can be established with the given identity file
func (a *App) ProbeConnection(req SSHDeployRequest) (string, error) {
	return a.SSH.ProbePublicKey(req.Host, req.User, req.Port, req.IdentityFile)
}

// VerifyPassword checks if the provided password is valid for the remote user
func (a *App) VerifyPassword(req SSHDeployRequest) (string, error) {
	return a.SSH.VerifyPassword(req.Host, req.User, req.Port, req.Password)
}

// IsPremium checks if the user has premium features enabled.
// Currently defaulted to true as per requirements.
func (a *App) IsPremium() bool {
	return true
}

// SetupManagedIdentity generates a secure key pair and deploys it to the remote server.
// Returns the path to the private key on success.
func (a *App) SetupManagedIdentity(req SSHDeployRequest) (string, error) {
	if !a.IsPremium() {
		return "", fmt.Errorf("premium feature required")
	}

	keyName := "id_mlcremote_ed25519"

	// Check if already exists in config dir (~/.config/MLCRemote/keys/...)
	// We can reuse the same identity for multiple servers for simplicity in this iteration,
	// or generate unique ones. For now, let's reuse a single global "Managed Identity".
	// The GenerateEd25519Key function handles overwrite or reuse checks logic?
	// Actually keygen.go currently blindly creates/overwrites unless we check.
	// Let's modify keygen to be idempotent or check existence here.

	// For this feature, let's just try to find it first.
	// But since we don't have a specific "FindManagedIdentity" exposed on SSH manager yet,
	// and we want to ensure we have the key, let's just call Generate.
	// However, we should be careful not to overwrite if it exists and is in use.
	// Ideally, we load it if exists.

	// Let's add a wrapper in SSH manager to "GetOrGenerateManagedIdentity"
	// But since I can't easily modify Manager interface without more edits,
	// I will implement the logic:
	// 1. Generate (or get existing path)
	// 2. Deploy

	privPath, _, err := a.SSH.GenerateEd25519Key(keyName)
	if err != nil {
		// If it fails because it exists (we should handle that in keygen or here),
		// but keygen.go implementation from previous step overwrites!
		// Wait, the previous step's keygen.go implementation uses os.WriteFile which overwrites.
		// We probably want to Check if it exists first to avoid rotating the key for ALL servers if the user does this for a second server.
		return "", fmt.Errorf("failed to generate identity: %w", err)
	}

	// Deploy the public key using the password
	err = a.SSH.DeployPublicKey(req.Host, req.User, req.Port, req.Password, privPath)
	if err != nil {
		return "", fmt.Errorf("failed to deploy public key: %w", err)
	}

	return privPath, nil
}

// GetManagedIdentity returns the public key of the managed identity.
// It ensures the key exists (creating it if necessary, though typical flow is via Setup).
func (a *App) GetManagedIdentity() (string, error) {
	if !a.IsPremium() {
		return "", fmt.Errorf("premium feature required")
	}
	keyName := "id_mlcremote_ed25519"
	// GenerateEd25519Key is now idempotent (gets or generates)
	_, pubKey, err := a.SSH.GenerateEd25519Key(keyName)
	if err != nil {
		return "", fmt.Errorf("failed to get managed identity: %w", err)
	}
	return pubKey, nil
}

// GetManagedIdentityPath returns the absolute path to the managed private key.
func (a *App) GetManagedIdentityPath() (string, error) {
	if !a.IsPremium() {
		return "", fmt.Errorf("premium feature required")
	}
	// We can reuse GenerateEd25519Key logic to resolve the path without regenerating if it exists
	// But GenerateEd25519Key returns (path, pub, err).
	keyName := "id_mlcremote_ed25519"
	path, _, err := a.SSH.GenerateEd25519Key(keyName)
	if err != nil {
		return "", fmt.Errorf("failed to resolve managed identity path: %w", err)
	}
	return path, nil
}

// PickIdentityFile opens a file dialog to select a private key
func (a *App) PickIdentityFile() (string, error) {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Identity File",
		Filters: []runtime.FileFilter{
			{DisplayName: "SSH Keys", Pattern: "*;*.*"}, // All files, as keys often have no ext
		},
	})
	if err != nil {
		return "", err
	}
	return selection, nil
}

// HealthCheck checks whether the backend at the given URL responds to /health
func (a *App) HealthCheck(url string, token string, timeoutSeconds int) (string, error) {
	client := http.Client{Timeout: time.Duration(timeoutSeconds) * time.Second}
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/health", url), nil)
	if err != nil {
		return "not-found", err
	}
	if token != "" {
		req.Header.Set("X-Auth-Token", token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "not-found", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return "ok", nil
	}
	return "not-ok", nil
}

// GetRemoteSession retrieves information about the existing backend session on the remote host
func (a *App) GetRemoteSession(profileJSON string) (*backend.SessionInfo, error) {
	return a.Backend.GetRemoteSession(profileJSON)
}

// KillRemoteSession terminates the existing backend session
func (a *App) KillRemoteSession(profileJSON string) error {
	return a.Backend.KillRemoteSession(profileJSON)
}
