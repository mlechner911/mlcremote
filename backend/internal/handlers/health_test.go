// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"testing"
	"time"
)

// TestSampleCPUPercent ensures sampling function runs and returns a value in expected range.
func TestSampleCPUPercent(t *testing.T) {
    // call with short delay; function may return -1 on unsupported platforms
    v := sampleCPUPercent(50 * time.Millisecond)
    if v < -1.0 {
        t.Fatalf("unexpected cpu percent < -1: %v", v)
    }
    if v > 100.0 {
        t.Fatalf("unexpected cpu percent > 100: %v", v)
    }
    // log the value for informational purposes
    t.Logf("sampleCPUPercent returned: %v", v)
}
