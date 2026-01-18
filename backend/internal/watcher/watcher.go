package watcher

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// EventType represents the type of filesystem event
type EventType string

const (
	EventFileChange EventType = "file_change"
	EventDirChange  EventType = "dir_change"
)

// Event is the payload sent to clients
type Event struct {
	Type EventType `json:"type"`
	Path string    `json:"path"`
}

// Service handles filesystem watching and event broadcasting
type Service struct {
	watcher *fsnotify.Watcher
	root    string
	clients map[chan Event]bool
	mu      sync.Mutex
	done    chan struct{}
}

// New creates a new watcher service
func New(root string) (*Service, error) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	s := &Service{
		watcher: w,
		root:    root,
		clients: make(map[chan Event]bool),
		done:    make(chan struct{}),
	}

	return s, nil
}

// Start begins watching the filesystem and broadcasting events
func (s *Service) Start() {
	// Add recursive watches
	if err := s.addRecursive(s.root); err != nil {
		log.Printf("[WATCHER] error adding watches: %v", err)
	}

	go s.loop()
}

// Stop stops the watcher
func (s *Service) Stop() {
	close(s.done)
	s.watcher.Close()
}

// Subscribe listens for events
func (s *Service) Subscribe() chan Event {
	s.mu.Lock()
	defer s.mu.Unlock()
	ch := make(chan Event, 100) // Buffer to prevent blocking
	s.clients[ch] = true
	return ch
}

// Unsubscribe removes a listener
func (s *Service) Unsubscribe(ch chan Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.clients[ch]; ok {
		delete(s.clients, ch)
		close(ch)
	}
}

func (s *Service) loop() {
	tick := time.NewTicker(100 * time.Millisecond) // Debounce/throttle logic could replace this
	defer tick.Stop()

	// Simple debounce map
	// path -> timestamp
	lastEvent := make(map[string]time.Time)

	for {
		select {
		case <-s.done:
			return
		case event, ok := <-s.watcher.Events:
			if !ok {
				return
			}

			// Log raw event
			log.Printf("[WATCHER] Raw event: %s %s", event.Op, event.Name)

			// Ignore CHMOD
			if event.Op&fsnotify.Chmod == fsnotify.Chmod {
				continue
			}

			// Relative path for client
			relPath, err := filepath.Rel(s.root, event.Name)
			if err != nil {
				log.Printf("[WATCHER] Rel error: %v (root=%s, name=%s)", err, s.root, event.Name)
				continue
			}
			// Use forward slashes for API consistency
			relPath = "/" + filepath.ToSlash(relPath)

			// Ignore .git, .mlcremote, etc
			if strings.Contains(relPath, "/.git/") || strings.Contains(relPath, "/.mlcremote/") {
				continue
			}

			// Debounce
			if time.Since(lastEvent[relPath]) < 500*time.Millisecond {
				log.Printf("[WATCHER] Debounced: %s", relPath)
				continue
			}
			lastEvent[relPath] = time.Now()

			// Handle new directories (Watcher doesn't auto-watch new dirs on Linux)
			// But fsnotify usually handles it if we react to Create
			if event.Op&fsnotify.Create == fsnotify.Create {
				fi, err := os.Stat(event.Name)
				if err == nil && fi.IsDir() {
					log.Printf("[WATCHER] Watching new dir: %s", event.Name)
					s.watcher.Add(event.Name)
				}
			}

			// Determine event type
			// Ideally we want to know if it's a file or dir for the UI
			// If we can't stat (deleted), we assume file unless we knew it was a dir?
			// Simplification: trigger generic changes.
			// But for optimized UI, let's try to be specific.

			evtType := EventFileChange
			// If it's a rename/remove of a directory, we might not know.
			// But we know 'event.Name'.

			log.Printf("[WATCHER] Broadcasting: %s %s", evtType, relPath)

			// Let's Broadcast
			s.broadcast(Event{
				Type: evtType,
				Path: relPath,
			})

			// If a new directory was created, we might want to also signal the *parent* changed?
			// Or checking `dir_change` vs `file_change`.
			// Since FileTree updates a folder when signaled, we should signal the parent directory
			// if a file inside it changes?
			// Actually the current frontend logic signals the *node* to refresh events for *that node`.
			// If I add `foo/bar.txt`, `foo` needs to refresh.
			// So if `relPath` changes, we should maybe emit a DirChange for the parent?

			// Let's emit a specific event for the file, and the frontend will decide.
			// The frontend `refreshSignal` checks if `refreshSignal.path === entry.path`.
			// So if we emit `path: "/foo"`, then `/foo` refreshes.
			// If a file `/foo/bar.txt` changes, we should emit `path: "/foo"`.

			parentDir := filepath.Dir(relPath)
			if parentDir == "\\" || parentDir == "." {
				parentDir = "/"
			}
			parentDir = filepath.ToSlash(parentDir)

			// Emit dir change for parent (to refresh tree)
			s.broadcast(Event{
				Type: EventDirChange,
				Path: parentDir,
			})

		case err, ok := <-s.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("[WATCHER] error: %v", err)
		}
	}
}

func (s *Service) broadcast(e Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	log.Printf("[WATCHER] Sending event to %d clients: %v", len(s.clients), e)
	for ch := range s.clients {
		select {
		case ch <- e:
		default:
			// Drop event if client too slow
		}
	}
}

func (s *Service) addRecursive(path string) error {
	return filepath.Walk(path, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			// Skip .git, etc
			if strings.HasPrefix(info.Name(), ".") && info.Name() != "." {
				return filepath.SkipDir
			}
			return s.watcher.Add(p)
		}
		return nil
	})
}
