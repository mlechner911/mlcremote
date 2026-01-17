//go:build !windows

package clipboard

type platformClipboard struct{}

func newPlatformClipboard() ClipboardManager {
	return &platformClipboard{}
}

func (c *platformClipboard) WriteFiles(paths []string) error {
	// TODO: Implement for macOS (NSPasteboard) and Linux (X11/Wayland)
	return nil
}

func (c *platformClipboard) ReadFiles() ([]string, error) {
	// TODO: Implement for macOS (NSPasteboard) and Linux (X11/Wayland)
	return []string{}, nil
}
