//go:build windows

package handlers

import "os"

// resolveAccess on Windows stub.
// Real permission checking on Windows is complex (ACLs).
// For now, we rely on the generic ReadOnly attribute mapped to mode.
func resolveAccess(info os.FileInfo) (bool, bool, bool) {
	m := info.Mode()
	// Windows only really maps the ReadOnly attribute to 0200 (Write)
	// Read and Exec are generally assumed true if file implies it,
	// unless we check ACLs which is out of scope.
	canWrite := m&0200 != 0
	return true, canWrite, true
}
