package clipboard

// ClipboardManager defines the interface for OS-specific clipboard file operations.
type ClipboardManager interface {
	// WriteFiles puts the given file paths onto the system clipboard (e.g. CF_HDROP).
	WriteFiles(paths []string) error

	// ReadFiles returns the list of file paths currently on the system clipboard.
	// Returns empty list if no files are on the clipboard.
	ReadFiles() ([]string, error)
}

var instance ClipboardManager

// Get returns the singleton ClipboardManager instance.
func Get() ClipboardManager {
	if instance == nil {
		instance = newPlatformClipboard()
	}
	return instance
}
