package main

import (
	"crypto/md5"
	"fmt"
	"io"
	"os"
)

// only used if builtin md5 not found on os
func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: md5-util <file>")
		os.Exit(1)
	}

	path := os.Args[1]
	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening file: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	h := md5.New()
	if _, err := io.Copy(h, f); err != nil {
		fmt.Fprintf(os.Stderr, "Error hashing file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("%x\n", h.Sum(nil))
}
