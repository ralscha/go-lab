package main

import (
	"errors"
	"net/http"
	"os"
	"strconv"
	"time"
)

const maxJobsPerHour = 120

func (a *app) runnerEnabled() (bool, error) {
	if !a.config.enabled {
		return false, nil
	}
	// Lstat also treats a dangling symlink as an emergency disable marker.
	_, err := os.Lstat(a.disabledFile)
	if err == nil {
		return false, nil
	}
	if errors.Is(err, os.ErrNotExist) {
		return true, nil
	}
	return false, err
}

func (a *app) ensureRunnerEnabled(w http.ResponseWriter) bool {
	enabled, err := a.runnerEnabled()
	if err != nil {
		fail(w, 503, "cannot check the runner disable switch")
		return false
	}
	if !enabled {
		fail(w, 503, "the local runner is disabled by the administrator")
		return false
	}
	return true
}

// Reserve both limits atomically. The caller holds the permit through container cleanup.
func (a *app) admit(w http.ResponseWriter, address string) (release func(), ok bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	now := time.Now()
	for len(a.jobStarts) > 0 && now.Sub(a.jobStarts[0]) >= time.Hour {
		a.jobStarts = a.jobStarts[1:]
	}
	if a.activeIPs[address] {
		w.Header().Set("Retry-After", "40")
		fail(w, 429, "you already have a runner job in progress; wait for it to finish")
		return nil, false
	}
	if len(a.jobStarts) >= maxJobsPerHour {
		remaining := time.Hour - now.Sub(a.jobStarts[0])
		w.Header().Set("Retry-After", strconv.FormatInt(int64((remaining+time.Second-1)/time.Second), 10))
		fail(w, 429, "the shared runner quota is exhausted; retry after the hourly limit resets")
		return nil, false
	}
	select {
	case a.slots <- struct{}{}:
	default:
		fail(w, 503, "runner busy; try again shortly")
		return nil, false
	}
	a.activeIPs[address] = true
	a.jobStarts = append(a.jobStarts, now)
	return func() {
		a.mu.Lock()
		defer a.mu.Unlock()
		delete(a.activeIPs, address)
		<-a.slots
	}, true
}
