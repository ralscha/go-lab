package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const maxSource = 48 << 10

type request struct {
	Code         string `json:"code"`
	Mode         string `json:"mode"`
	Optimization string `json:"optimization"`
}
type result struct {
	Success   bool   `json:"success"`
	Stdout    string `json:"stdout"`
	Stderr    string `json:"stderr"`
	ElapsedMS int64  `json:"elapsedMs"`
	Code      string `json:"code,omitempty"`
}
type runner interface {
	run(context.Context, string, request) (result, error)
}
type rate struct {
	start time.Time
	count int
}
type app struct {
	runner  runner
	root    string
	slots   chan struct{}
	mu      sync.Mutex
	rates   map[string]rate
	origins map[string]bool
}

func newApp(r runner, root string) *app {
	a := &app{runner: r, root: root, slots: make(chan struct{}, 4), rates: map[string]rate{}, origins: map[string]bool{}}
	for origin := range strings.SplitSeq(env("ALLOWED_ORIGINS", "http://localhost:4201,http://127.0.0.1:4201"), ",") {
		a.origins[strings.TrimSpace(origin)] = true
	}
	return a
}
func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, message string) {
	respond(w, status, map[string]any{"success": false, "error": message})
}
func (a *app) allowed(r *http.Request) bool {
	if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
		return false
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	return a.origins[origin] || (err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host == r.Host && u.Path == "" && u.User == nil)
}

// Restrict Host as well as Origin to prevent DNS rebinding against a loopback server.
func (a *app) allowedHost(host string) bool {
	name := host
	if parsed, _, err := net.SplitHostPort(host); err == nil {
		name = parsed
	}
	if strings.EqualFold(name, "localhost") {
		return true
	}
	if ip := net.ParseIP(strings.Trim(name, "[]")); ip != nil && ip.IsLoopback() {
		return true
	}
	for origin := range a.origins {
		if u, err := url.Parse(origin); err == nil && u.Host == host {
			return true
		}
	}
	return false
}
func (a *app) limited(r *http.Request) bool {
	address, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		address = r.RemoteAddr
	}
	now := time.Now()
	a.mu.Lock()
	defer a.mu.Unlock()
	for key, entry := range a.rates {
		if now.Sub(entry.start) >= time.Minute {
			delete(a.rates, key)
		}
	}
	entry := a.rates[address]
	if entry.start.IsZero() {
		entry.start = now
	}
	entry.count++
	if len(a.rates) >= 4096 && entry.count == 1 {
		return true
	}
	a.rates[address] = entry
	return entry.count > 30
}
func decode(w http.ResponseWriter, r *http.Request, operation string) (request, error) {
	var input request
	media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "application/json" {
		return input, fmt.Errorf("Content-Type must be application/json")
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		return input, fmt.Errorf("invalid request JSON: %w", err)
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return input, fmt.Errorf("send exactly one JSON object")
	}
	if strings.TrimSpace(input.Code) == "" || len(input.Code) > maxSource {
		return input, fmt.Errorf("source must contain 1-%d bytes", maxSource)
	}
	if operation == "format" && (input.Mode != "" || input.Optimization != "") {
		return input, fmt.Errorf("format accepts only code")
	}
	if input.Mode == "" {
		input.Mode = "run"
	}
	if input.Optimization == "" {
		input.Optimization = "default"
	}
	if input.Mode != "run" && input.Mode != "test" {
		return input, fmt.Errorf("mode must be run or test")
	}
	if input.Optimization != "default" && input.Optimization != "race" {
		return input, fmt.Errorf("optimization must be default or race")
	}
	return input, nil
}
func (a *app) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !a.allowedHost(r.Host) {
		fail(w, http.StatusForbidden, "request host is not allowed")
		return
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "same-origin")
	w.Header().Set("X-Frame-Options", "DENY")
	if !strings.HasPrefix(r.URL.Path, "/api/") {
		a.static(w, r)
		return
	}
	if !a.allowed(r) {
		fail(w, 403, "browser origin is not allowed")
		return
	}
	if r.URL.Path == "/api/health" && r.Method == http.MethodGet {
		respond(w, 200, map[string]any{"status": "ok", "provider": "Local Docker", "referenceVersion": "1.27.4", "maxSourceBytes": maxSource})
		return
	}
	operation := strings.TrimPrefix(r.URL.Path, "/api/")
	if operation != "execute" && operation != "format" && operation != "version" {
		fail(w, 404, "API endpoint not found")
		return
	}
	method := http.MethodPost
	if operation == "version" {
		method = http.MethodGet
	}
	if r.Method != method {
		w.Header().Set("Allow", method)
		fail(w, 405, "method not allowed")
		return
	}
	var input request
	if operation != "version" {
		var err error
		input, err = decode(w, r, operation)
		if err != nil {
			status := 400
			if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
				status = 413
			}
			fail(w, status, err.Error())
			return
		}
	}
	if a.limited(r) {
		w.Header().Set("Retry-After", "60")
		fail(w, 429, "too many requests; try again in a minute")
		return
	}
	select {
	case a.slots <- struct{}{}:
		defer func() { <-a.slots }()
	default:
		fail(w, 503, "runner busy; try again shortly")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 35*time.Second)
	defer cancel()
	output, err := a.runner.run(ctx, operation, input)
	if err != nil {
		fail(w, 503, err.Error())
		return
	}
	if operation == "version" {
		if !output.Success {
			fail(w, 503, "compiler metadata unavailable")
			return
		}
		fields := strings.Fields(output.Stdout)
		if len(fields) < 3 || !strings.HasPrefix(fields[2], "go") {
			fail(w, 503, "invalid compiler metadata")
			return
		}
		respond(w, 200, map[string]string{"version": strings.TrimPrefix(fields[2], "go"), "provider": "Local Docker", "referenceVersion": "1.27.4"})
		return
	}
	if operation == "format" {
		output.Code = input.Code
		if output.Success {
			output.Code = output.Stdout
		}
	}
	respond(w, 200, output)
}
func (a *app) static(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", 405)
		return
	}
	clean := strings.TrimPrefix(r.URL.Path, "/")
	if clean == "" {
		clean = "index.html"
	}
	if strings.Contains(clean, "\\") || !filepath.IsLocal(clean) {
		http.NotFound(w, r)
		return
	}
	file := filepath.Join(a.root, filepath.FromSlash(clean))
	info, err := os.Stat(file)
	if err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, file)
}
