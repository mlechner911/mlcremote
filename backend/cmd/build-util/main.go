package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

// we use this as a helper tool for the build process
// to provide feedback on assets and binary size.
// (in Makefile) make prepare-payload
func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	switch cmd {
	case "ls-r":
		if len(args) < 1 {
			fmt.Println("Usage: build-util ls-r <dir>")
			os.Exit(1)
		}
		if err := listRecursive(args[0]); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	case "size":
		if len(args) < 1 {
			fmt.Println("Usage: build-util size <file>")
			os.Exit(1)
		}
		if err := showSize(args[0]); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Usage: build-util <command> [args...]")
	fmt.Println("Commands:")
	fmt.Println("  ls-r <dir>   List directory recursively with file sizes")
	fmt.Println("  size <file>  Show size of a single file")
}

func listRecursive(root string) error {
	fmt.Printf("\nlisting files in %s:\n", root)
	return filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			// Don't fail entire walk if one file is inaccessible, just warn
			fmt.Fprintf(os.Stderr, "Access denied: %v\n", err)
			return nil
		}
		if !d.IsDir() {
			info, err := d.Info()
			if err != nil {
				return err
			}
			rel, _ := filepath.Rel(root, path)
			fmt.Printf("%-10s %s\n", formatBytes(info.Size()), rel)
		}
		return nil
	})
}

func showSize(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	fmt.Printf("%s size: %s\n", filepath.Base(path), formatBytes(info.Size()))
	return nil
}

func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
