//go:build !windows

package remotesystem

import (
	"os/exec"
)

// ConfigureCmd applies platform-specific attributes to the command.
// On Unix-like systems, this is a no-op.
func ConfigureCmd(cmd *exec.Cmd) {
	// No-op
}
