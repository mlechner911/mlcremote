package monitoring

import (
	"log"
	"sync"
	"time"
)

// Stats represents the structure returned by the backend API
type Stats struct {
	Timestamp int64   `json:"timestamp"`
	CPU       float64 `json:"cpu"`
	Memory    float64 `json:"memory"`
	Disk      float64 `json:"disk"`
	Uptime    uint64  `json:"uptime"`
}

// Poller is a function that retrieves stats for a given profile
type Poller func(cfg MonitoringConfig) (Stats, error)

type Service struct {
	mu           sync.RWMutex
	profiles     map[string]MonitoringConfig
	serverStatus map[string]Stats
	stopChan     chan struct{}
	poller       Poller
}

// MonitoringConfig matches frontend Profile monitoring settings
type MonitoringConfig struct {
	ID       string
	Name     string
	Enabled  bool
	Interval int // minutes
	NextRun  time.Time
}

func NewService(poller Poller) *Service {
	return &Service{
		profiles:     make(map[string]MonitoringConfig),
		serverStatus: make(map[string]Stats),
		poller:       poller,
	}
}

func (s *Service) Start() {
	s.stopChan = make(chan struct{})
	go s.loop()
}

func (s *Service) Stop() {
	if s.stopChan != nil {
		close(s.stopChan)
		s.stopChan = nil
	}
}

func (s *Service) loop() {
	ticker := time.NewTicker(30 * time.Second) // Check every 30s if any profile needs update
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.checkAll()
		case <-s.stopChan:
			return
		}
	}
}

func (s *Service) checkAll() {
	s.mu.Lock()
	params := make([]MonitoringConfig, 0, len(s.profiles))
	now := time.Now()
	for _, cfg := range s.profiles {
		if cfg.Enabled && cfg.Name != "" && now.After(cfg.NextRun) {
			params = append(params, cfg)
		}
	}
	s.mu.Unlock()

	for _, cfg := range params {
		go s.pollProfile(cfg)
	}
}

// pollProfile attempts to connect and fetch stats
func (s *Service) pollProfile(cfg MonitoringConfig) {
	if !cfg.Enabled || cfg.Name == "" {
		return
	}

	log.Printf("[Monitoring] Polling %s...", cfg.Name)

	stats, err := s.poller(cfg)
	if err != nil {
		log.Printf("[Monitoring] Failed to poll %s: %v", cfg.Name, err)
	} else {
		s.mu.Lock()
		s.serverStatus[cfg.ID] = stats
		s.mu.Unlock()
	}

	// update NextRun
	s.mu.Lock()
	if c, ok := s.profiles[cfg.ID]; ok {
		c.NextRun = time.Now().Add(time.Duration(cfg.Interval) * time.Minute)
		s.profiles[cfg.ID] = c
	}
	s.mu.Unlock()
}

// UpdateProfiles is called from frontend when settings change
func (s *Service) UpdateProfiles(configs []MonitoringConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Merge logic: keep existing NextRun if possible
	for _, newCfg := range configs {
		if old, ok := s.profiles[newCfg.ID]; ok {
			newCfg.NextRun = old.NextRun
		} else {
			newCfg.NextRun = time.Now() // Run immediately on first add
		}
		s.profiles[newCfg.ID] = newCfg
	}
}

func (s *Service) GetStats(profileID string) Stats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.serverStatus[profileID]
}
