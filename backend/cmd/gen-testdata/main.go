package main

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/base64"
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	outDir := flag.String("out", "testdata", "Output directory")
	flag.Parse()

	if err := os.MkdirAll(*outDir, 0755); err != nil {
		panic(err)
	}

	createImages(*outDir)
	createArchives(*outDir)
	createDocs(*outDir)
	createReadOnly(*outDir)
	createStructs(*outDir)

	fmt.Println("Test data generated in", *outDir)
}

func createImages(root string) {
	dir := filepath.Join(root, "images")
	os.MkdirAll(dir, 0755)

	// SVG
	os.WriteFile(filepath.Join(dir, "circle.svg"), []byte(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="50" fill="red" />
</svg>`), 0644)

	// PNG (Minimal 1x1 Red Pixel)
	png, _ := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
	os.WriteFile(filepath.Join(dir, "pixel.png"), png, 0644)

	// JPG
	jpg, _ := base64.StdEncoding.DecodeString("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=")
	os.WriteFile(filepath.Join(dir, "pixel.jpg"), jpg, 0644)
}

func createDocs(root string) {
	dir := filepath.Join(root, "docs")
	os.MkdirAll(dir, 0755)

	// Markdown
	os.WriteFile(filepath.Join(dir, "README.md"), []byte(`# Test Markdown
This is a **bold** statement.
- Item 1
- Item 2

`+"```go\nfunc main() {}\n```"), 0644)

	// PDF (Minimal)
	pdf, _ := base64.StdEncoding.DecodeString("JVBERi0xLjEKJcKlwrHDqwoKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPjwKZW5kb2JqCgoyIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2VzCiAgICAgL0tpZHMgWzMgMCBSXQogICAgIC9Db3VudCAxCiAgICAgL01lZGlhQm94IFswIDAgMzAwIDE0NF0KICA+PgplbmRvYmoKCjMgMCBvYmoKICA8PCAgL1R5cGUgL1BhZ2UKICAgICAgL1BhcmVudCAyIDAgUgogICAgICAvUmVzb3VyY2VzCiAgICAgICA8PCAvRm9udAogICAgICAgICAgIDw8IC9GMKAgICAgICAgICAgICAgIDw8IC9UeXBlIC9Gb250CiAgICAgICAgICAgICAgICAgL1N1YnR5cGUgL1R5cGUxCiAgICAgICAgICAgICAgICAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgogICAgICAgICAgICAgID4+CiAgICAgICAgICAgPj4KICAgICAgID4+CiAgICAgIC9Db250ZW50cyA0IDAgUgogID4+CmVuZG9iagoKNCAwIG9iagogIDw8IC9MZW5ndGggNTUgPj4Kc3RyZWFtCiAgQlQKICAgIC9GMCAxOCBUZgogICAgMCAwIFRkCiAgICAoSGVsbG8gV29ybGQpIFRqCiAgRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDE1NyAwMDAwMCBuIAowMDAwMDAwMzI1IDAwMDAwIG4gCnRyYWlsZXIKICA8PCAgL1Jvb3QgMSAwIFIKICAgICAgL1NpemUgNQogID4+CnN0YXJ0eHJlZgo0MTMKJSVFT0YK")
	os.WriteFile(filepath.Join(dir, "test.pdf"), pdf, 0644)

	// Text
	os.WriteFile(filepath.Join(dir, "plain.txt"), []byte("Just some plain text."), 0644)
}

func createArchives(root string) {
	dir := filepath.Join(root, "archives")
	os.MkdirAll(dir, 0755)

	// ZIP
	f, _ := os.Create(filepath.Join(dir, "test.zip"))
	zw := zip.NewWriter(f)
	w, _ := zw.Create("hello.txt")
	w.Write([]byte("Hello inside zip"))
	zw.Close()
	f.Close()

	// TAR
	f, _ = os.Create(filepath.Join(dir, "test.tar"))
	tw := tar.NewWriter(f)
	body := []byte("Hello inside tar")
	hdr := &tar.Header{
		Name: "hello.txt",
		Mode: 0600,
		Size: int64(len(body)),
	}
	tw.WriteHeader(hdr)
	tw.Write(body)
	tw.Close()
	f.Close()

	// TGZ
	f, _ = os.Create(filepath.Join(dir, "test.tgz"))
	gw := gzip.NewWriter(f)
	tw = tar.NewWriter(gw)
	hdr = &tar.Header{
		Name: "hello.txt",
		Mode: 0600,
		Size: int64(len(body)),
	}
	tw.WriteHeader(hdr)
	tw.Write(body)
	tw.Close()
	gw.Close()
	f.Close()
}

func createReadOnly(root string) {
	dir := filepath.Join(root, "readonly")
	os.MkdirAll(dir, 0755)

	path := filepath.Join(dir, "cant_touch_this.txt")
	os.WriteFile(path, []byte("Read only file"), 0444)
	// Enforce chmod (WriteFile might be affected by umask)
	os.Chmod(path, 0444)
}

func createStructs(root string) {
	dir := filepath.Join(root, "deep")
	os.MkdirAll(filepath.Join(dir, "level1", "level2", "level3"), 0755)
	os.WriteFile(filepath.Join(dir, "level1", "level2", "level3", "deep.txt"), []byte("Deep file"), 0644)
}
