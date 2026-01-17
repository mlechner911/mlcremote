//go:build windows

package clipboard

import (
	"fmt"
	"syscall"
	"unicode/utf16"
	"unsafe"
)

var (
	user32                     = syscall.NewLazyDLL("user32.dll")
	kernel32                   = syscall.NewLazyDLL("kernel32.dll")
	openClipboard              = user32.NewProc("OpenClipboard")
	closeClipboard             = user32.NewProc("CloseClipboard")
	emptyClipboard             = user32.NewProc("EmptyClipboard")
	setClipboardData           = user32.NewProc("SetClipboardData")
	getClipboardData           = user32.NewProc("GetClipboardData")
	isClipboardFormatAvailable = user32.NewProc("IsClipboardFormatAvailable")
	dragQueryFileWA            = syscall.NewLazyDLL("shell32.dll").NewProc("DragQueryFileW")

	globalAlloc  = kernel32.NewProc("GlobalAlloc")
	globalLock   = kernel32.NewProc("GlobalLock")
	globalUnlock = kernel32.NewProc("GlobalUnlock")
	globalFree   = kernel32.NewProc("GlobalFree")
)

const (
	CF_HDROP      = 15
	GMEM_MOVEABLE = 0x0002
	GMEM_ZEROINIT = 0x0040 // GPTR = GMEM_FIXED | GMEM_ZEROINIT. For clipboard we need MOVEABLE usually? NO, GlobalAlloc(GHND) or GMEM_MOVEABLE.
	// GHND = GMEM_MOVEABLE | GMEM_ZEROINIT
	GHND = 0x0042
)

// DROPFILES structure for CF_HDROP
// https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/ns-shlobj_core-dropfiles
type DROPFILES struct {
	pFiles uint32 // Offset of the file list (DWORD)
	pt     POINT  // Drop point
	fNC    int32  // Non-client area (BOOL)
	fWide  int32  // Wide character flag (BOOL)
}

type POINT struct {
	x int32
	y int32
}

type platformClipboard struct{}

func newPlatformClipboard() ClipboardManager {
	return &platformClipboard{}
}

func (c *platformClipboard) WriteFiles(paths []string) error {
	if len(paths) == 0 {
		return nil
	}

	// 1. Calculate buffer size
	// Structure + (utf16 strings + null) ... + double null
	var filesBuffer []uint16
	for _, p := range paths {
		// utf16.Encode returns existing valid utf16, we assume windows paths are clean
		wChars := utf16.Encode([]rune(p))
		filesBuffer = append(filesBuffer, wChars...)
		filesBuffer = append(filesBuffer, 0) // Null terminator
	}
	filesBuffer = append(filesBuffer, 0) // Double null terminator at end

	dropFilesSize := unsafe.Sizeof(DROPFILES{})
	filesBufferSize := uintptr(len(filesBuffer) * 2) // 2 bytes per uint16
	totalSize := dropFilesSize + filesBufferSize

	// 2. Open Clipboard
	// Need a window handle. Passing 0 uses current task.
	ret, _, _ := openClipboard.Call(0)
	if ret == 0 {
		return fmt.Errorf("failed to open clipboard")
	}
	defer closeClipboard.Call()

	emptyClipboard.Call()

	// 3. Allocate Global Memory
	hMem, _, _ := globalAlloc.Call(GHND, totalSize)
	if hMem == 0 {
		return fmt.Errorf("failed to allocate global memory")
	}

	// 4. Lock Memory
	ptr, _, _ := globalLock.Call(hMem)
	if ptr == 0 {
		globalFree.Call(hMem)
		return fmt.Errorf("failed to lock global memory")
	}

	// 5. Write Data
	// Write DROPFILES struct
	df := (*DROPFILES)(unsafe.Pointer(ptr))
	df.pFiles = uint32(dropFilesSize) // Offset to files list
	df.fWide = 1                      // Unicode
	// fNC and pt are zero

	// Write Files list
	// Pointer arithmetic to get to the file data area
	dataPtr := uintptr(ptr) + dropFilesSize
	// Copy slices to unsafe pointer logic
	// We iterate and write bytes or use Copy memory equivalent
	// Simple way: cast to *[big]uint16 and copy
	// But go vet dislikes unsafe usage of slicing large arrays.
	// Since we built the buffer in Go, we can iterate.

	targetSlice := (*[1 << 30]uint16)(unsafe.Pointer(dataPtr))[:len(filesBuffer):len(filesBuffer)]
	copy(targetSlice, filesBuffer)

	// 6. Unlock
	globalUnlock.Call(hMem)

	// 7. Set Clipboard Data
	// Setup ownership transfer to system
	ret, _, _ = setClipboardData.Call(CF_HDROP, hMem)
	if ret == 0 {
		// If set fails, we should free memory. If proper, system takes ownership and frees it.
		globalFree.Call(hMem)
		return fmt.Errorf("failed to set clipboard data")
	}

	return nil
}

func (c *platformClipboard) ReadFiles() ([]string, error) {
	// 1. Open Clipboard
	ret, _, _ := openClipboard.Call(0)
	if ret == 0 {
		// Can fail if open by another window
		return nil, fmt.Errorf("failed to open clipboard")
	}
	defer closeClipboard.Call()

	// 2. Check for CF_HDROP
	// 0x0F = CF_HDROP
	ret, _, _ = isClipboardFormatAvailable.Call(CF_HDROP)
	if ret == 0 {
		return nil, nil // Not an error, just no files
	}

	// 3. Get Clipboard Data
	hMem, _, _ := getClipboardData.Call(CF_HDROP)
	if hMem == 0 {
		return nil, nil
	}

	// 4. Lock Memory usually needed if we want to read DROPFILES struct manually?
	// But standard API usually suggests DragQueryFile.
	// However, DragQueryFile expects an HDROP handle.
	// hMem from GetClipboardData IS the HDROP handle.

	hDrop := hMem

	// 5. Use DragQueryFile to count files
	// count = DragQueryFileW(hDrop, 0xFFFFFFFF, nil, 0)
	countRet, _, _ := dragQueryFileWA.Call(hDrop, 0xFFFFFFFF, 0, 0)
	count := int(countRet)

	var files []string

	for i := 0; i < count; i++ {
		// Get length
		lenRet, _, _ := dragQueryFileWA.Call(hDrop, uintptr(i), 0, 0)
		length := int(lenRet) + 1 // +1 for null

		buf := make([]uint16, length)
		// Read data
		dragQueryFileWA.Call(hDrop, uintptr(i), uintptr(unsafe.Pointer(&buf[0])), uintptr(length))

		files = append(files, syscall.UTF16ToString(buf))
	}

	// Not needed to unlock/free if we use DragQueryFile handle?
	// Actually GetClipboardData returns a handle managed by clipboard (unless we copy it).
	// We strictly shouldn't modify it. Reading is fine.

	return files, nil
}
