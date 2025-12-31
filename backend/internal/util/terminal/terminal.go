package terminal

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/creack/pty"
)

    var AllowedShells = []string{"bash", "sh", "zsh"}

    // ResolveRequestedShell validates a requested shell string and returns an absolute
    // executable path when possible. Empty string indicates invalid/unsupported.
    func ResolveRequestedShell(req string) string {
        if req == "" {
            return ""
        }
        if strings.ContainsAny(req, " \t\n") {
            return ""
        }
        if filepath.IsAbs(req) {
            if fi, err := os.Stat(req); err == nil {
                if fi.Mode().IsRegular() && fi.Mode().Perm()&0111 != 0 {
                    return req
                }
            }
            return ""
        }
        for _, a := range AllowedShells {
            if req == a {
                if p, err := exec.LookPath(req); err == nil {
                    return p
                }
                return ""
            }
        }
        return ""
    }

    // StartShellPTY attempts to start a PTY running the requested shell with fallbacks.
    // It returns the PTY file, the exec.Cmd, or an error.
    func StartShellPTY(shell, cwd string) (*os.File, *exec.Cmd, error) {
        candidates := [][]string{}
        if shell != "" {
            if strings.HasPrefix(shell, "env ") {
                parts := strings.Fields(shell)
                if len(parts) > 1 {
                    candidates = append(candidates, parts)
                }
            } else {
                candidates = append(candidates, []string{shell})
            }
        }
        candidates = append(candidates, []string{"/bin/bash"})
        candidates = append(candidates, []string{"/usr/bin/bash"})
        candidates = append(candidates, []string{"bash"})
        candidates = append(candidates, []string{"zsh"})
        candidates = append(candidates, []string{"/bin/sh"})
        candidates = append(candidates, []string{"env", "bash"})

        var lastErr error
        tried := map[string]struct{}{}
        for _, parts := range candidates {
            var exe string
            var args []string
            if len(parts) == 1 {
                exe = parts[0]
                args = []string{}
                if filepath.IsAbs(exe) {
                    if fi, err := os.Stat(exe); err != nil || !fi.Mode().IsRegular() || fi.Mode().Perm()&0111 == 0 {
                        lastErr = err
                        continue
                    }
                } else {
                    if p, err := exec.LookPath(exe); err == nil {
                        exe = p
                    } else {
                        lastErr = err
                        continue
                    }
                }
            } else {
                exe = parts[0]
                args = parts[1:]
                if !filepath.IsAbs(exe) {
                    if p, err := exec.LookPath(exe); err == nil {
                        exe = p
                    } else {
                        lastErr = err
                        continue
                    }
                } else {
                    if fi, err := os.Stat(exe); err != nil {
                        lastErr = err
                        continue
                    } else {
                        _ = fi
                    }
                }
            }
            key := exe + " " + strings.Join(args, " ")
            if _, ok := tried[key]; ok {
                continue
            }
            tried[key] = struct{}{}

            cmd := exec.Command(exe, args...)
            if cwd != "" {
                if fi, err := os.Stat(cwd); err == nil {
                    if fi.IsDir() {
                        cmd.Dir = cwd
                    } else {
                        log.Printf("StartShellPTY: provided cwd is not a directory, skipping: %s", cwd)
                    }
                } else {
                    log.Printf("StartShellPTY: provided cwd does not exist, skipping: %s (%v)", cwd, err)
                }
            }
            ptmx, err := pty.Start(cmd)
            if err == nil {
                log.Printf("StartShellPTY: started shell '%s' (args='%v')", exe, args)
                return ptmx, cmd, nil
            }
            lastErr = err
            if filepath.IsAbs(exe) {
                if fi, statErr := os.Stat(exe); statErr == nil {
                    log.Printf("StartShellPTY: attempt '%v' failed:'%v' (file exists, mode='%v')", append([]string{exe}, args...), err, fi.Mode())
                    if perr, ok := err.(*os.PathError); ok {
                        if errno, ok := perr.Err.(syscall.Errno); ok {
                            switch errno {
                            case syscall.ENOEXEC:
                                log.Printf("StartShellPTY: exec failed with ENOEXEC for %s — file is not a valid executable or has an invalid interpreter", exe)
                            case syscall.ENOENT:
                                log.Printf("StartShellPTY: exec failed with ENOENT for %s — interpreter or loader may be missing", exe)
                            default:
                                log.Printf("StartShellPTY: exec syscall errno=%v", errno)
                            }
                        }
                    }
                    f, err2 := os.Open(exe)
                    if err2 == nil {
                        hdr := make([]byte, 4)
                        if _, err3 := f.Read(hdr); err3 == nil {
                            if string(hdr) == "\x7fELF" {
                                log.Printf("StartShellPTY: %s appears to be an ELF binary — missing interpreter/loader may cause ENOENT", exe)
                            } else if hdr[0] == '#' && hdr[1] == '!' {
                                log.Printf("StartShellPTY: %s is a script with shebang — interpreter in shebang may be missing", exe)
                            } else {
                                log.Printf("StartShellPTY: %s header: %v", exe, hdr)
                            }
                        }
                        _ = f.Close()
                    }
                } else {
                    log.Printf("StartShellPTY: attempt '%v' failed: '%v'", append([]string{exe}, args...), err)
                }
            } else {
                log.Printf("StartShellPTY: attempt '%v' failed: '%v'", append([]string{exe}, args...), err)
            }
        }
        return nil, nil, lastErr
    }

    // GenerateSessionID returns a random hex id prefixed with 's'.
    func GenerateSessionID() string {
        b := make([]byte, 16)
        _, err := rand.Read(b)
        if err != nil {
            return "s" + strconv.FormatInt(time.Now().UnixNano(), 10)
        }
        return "s" + hex.EncodeToString(b)
    }
