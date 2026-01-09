//go:build !windows

package handlers

import (
	"os"
	"syscall"
)

// resolveAccess checks if the current process has Read/Write/Execute permissions for the file.
// Returns (canRead, canWrite, canExec).
func resolveAccess(info os.FileInfo) (bool, bool, bool) {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		// Fallback if not syscall.Stat_t (should rare on Unix)
		// Assume we rely on mode bits relative to "other" if we can't tell owner
		// Or just return true/true/true to avoid blocking valid stuff?
		// Better: trust basic mode bits for user (assuming we are owner) or fallback safely.
		// Let's assume standard mode bits behaviour on the file itself.
		m := info.Mode()
		return m&0400 != 0, m&0200 != 0, m&0100 != 0
	}

	uid := uint32(os.Getuid())
	gid := uint32(os.Getgid())

	fileUid := stat.Uid
	fileGid := stat.Gid
	mode := info.Mode()
	perm := mode.Perm()

	var r, w, x bool

	if uid == 0 {
		// Root can read/write/exec anything generally (ignoring squash root/FS rules for now)
		// Actually root can only exec if at least one exec bit is set.
		return true, true, (perm&0111 != 0)
	}

	if uid == fileUid {
		// User bits
		r = perm&0400 != 0
		w = perm&0200 != 0
		x = perm&0100 != 0
	} else if gid == fileGid {
		// Group bits
		r = perm&0040 != 0
		w = perm&0020 != 0
		x = perm&0010 != 0
	} else {
		// We should also check if user is in the group (getgroups), checking only primary gid is imperfect but better than nothing.
		// For now, check Other bits
		r = perm&0004 != 0
		w = perm&0002 != 0
		x = perm&0001 != 0
	}

	// Todo: checking supplementary groups requires Os.Getgroups() and iterating.
	// That might be expensive for every file in a tree.
	// For now, this is a "Good Enough" heuristic for the reported use case (Owner vs Other).

	return r, w, x
}
