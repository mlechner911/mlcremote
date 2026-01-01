package app

import (
	"fmt"
	"net"
	"os/exec"
	"syscall"
)

// splitArgs is a naive splitter that handles quoted tokens roughly
func splitArgs(s string) []string {
	var out []string
	cur := ""
	inQuotes := false
	for _, r := range s {
		switch r {
		case ' ':
			if inQuotes {
				cur += string(r)
			} else if cur != "" {
				out = append(out, cur)
				cur = ""
			}
		case '"':
			inQuotes = !inQuotes
		default:
			cur += string(r)
		}
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

// netListenTCP tries to listen on localhost:port to detect availability.
func netListenTCP(port int) (net.Listener, error) {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	return net.Listen("tcp", addr)
}

// createSilentCmd works like exec.Command but hides the window on Windows.
func createSilentCmd(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow: true,
	}
	return cmd
}
