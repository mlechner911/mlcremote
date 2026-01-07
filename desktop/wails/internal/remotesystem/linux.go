package remotesystem

import (
	"fmt"
	"strings"
)

type Linux struct{}

func (l *Linux) GetOSName() string {
	return "linux"
}

func (l *Linux) GetHomeDir() string {
	return "~"
}

func (l *Linux) JoinPath(elem ...string) string {
	return strings.Join(elem, "/")
}

func (l *Linux) Mkdir(path string) string {
	return fmt.Sprintf("mkdir -p \"%s\"", path)
}

func (l *Linux) Remove(path string) string {
	return fmt.Sprintf("rm -rf \"%s\"", path)
}

func (l *Linux) FileHash(path string) (string, func(string) string) {
	// Uses the custom md5-util if available, fallback to md5sum
	// For now, we assume md5-util will be deployed to ~/.mlcremote/bin/md5-util
	// We'll use a shell condition to check for it? Or just assume it's there after deployment.
	// Let's rely on md5sum as fallback for now.
	// Actually, the plan says "Use this deployed binary".

	// We return a command that tries md5-util, then md5sum, then md5
	// cmd := "md5sum path | awk '{print $1}'"

	cmd := fmt.Sprintf("~/.mlcremote/bin/md5-util \"%s\" || md5sum \"%s\" | awk '{print $1}'", path, path)

	parser := func(output string) string {
		return strings.TrimSpace(output)
	}
	return cmd, parser
}

func (l *Linux) IsProcessRunning(pid string) string {
	return fmt.Sprintf("kill -0 %s", pid)
}

func (l *Linux) KillProcess(pid string) string {
	return fmt.Sprintf("kill -9 %s", pid)
}

func (l *Linux) FallbackKill(name string) string {
	return fmt.Sprintf("pkill -9 -f %s || true", name)
}

func (l *Linux) StartProcess(bin, args, logFile, pidFile string) string {
	// nohup bin args > log 2>&1 & echo $! > pid
	return fmt.Sprintf("nohup %s %s > %s 2>&1 & echo $! > %s", bin, args, logFile, pidFile)
}
