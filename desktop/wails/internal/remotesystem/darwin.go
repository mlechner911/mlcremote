package remotesystem

import (
	"fmt"
	"strings"
)

type Darwin struct{}

func (d *Darwin) GetOSName() string {
	return "darwin"
}

func (d *Darwin) GetHomeDir() string {
	return "~"
}

func (d *Darwin) JoinPath(elem ...string) string {
	return strings.Join(elem, "/")
}

func (d *Darwin) Mkdir(path string) string {
	return fmt.Sprintf("mkdir -p \"%s\"", path)
}

func (d *Darwin) Remove(path string) string {
	return fmt.Sprintf("rm -rf \"%s\"", path)
}

func (d *Darwin) FileHash(path string) (string, func(string) string) {
	// macOS uses 'md5 -q' for quiet output (just hash)
	// Try md5-util first (if deployed), then fallback to system md5
	cmd := fmt.Sprintf("~/.mlcremote/bin/md5-util \"%s\" || md5 -q \"%s\"", path, path)

	parser := func(output string) string {
		return strings.TrimSpace(output)
	}
	return cmd, parser
}

func (d *Darwin) IsProcessRunning(pid string) string {
	return fmt.Sprintf("kill -0 %s", pid)
}

func (d *Darwin) KillProcess(pid string) string {
	return fmt.Sprintf("kill -9 %s", pid)
}

func (d *Darwin) FallbackKill(name string) string {
	return fmt.Sprintf("pkill -9 -f %s || true", name)
}

func (d *Darwin) StartProcess(bin, args, logFile, pidFile string) string {
	return fmt.Sprintf("nohup %s %s > %s 2>&1 & echo $! > %s", bin, args, logFile, pidFile)
}
func (d *Darwin) GetStartupScript() (string, string) {
	return "", ""
}
