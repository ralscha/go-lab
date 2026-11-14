package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestRunnerConfiguration(t *testing.T) {
	for _, name := range []string{"RUNNER_RUNTIME", "RUNNER_REQUIRE_GVISOR", "RUNNER_ENABLED"} {
		t.Setenv(name, "")
		if err := os.Unsetenv(name); err != nil {
			t.Fatal(err)
		}
	}
	defaults, err := loadRunnerConfig()
	if err != nil || defaults != (runnerConfig{enabled: true}) {
		t.Fatalf("defaults: %+v, %v", defaults, err)
	}
	for _, tc := range []struct {
		name, runtime, required, enabled string
		valid                            bool
	}{
		{"default runtime", "", "false", "true", true},
		{"optional gvisor", "runsc", "false", "true", true},
		{"public gvisor", "runsc", "true", "true", true},
		{"disabled", "runsc", "true", "false", true},
		{"missing public runtime", "", "true", "true", false},
		{"disabled still requires gvisor", "", "true", "false", false},
		{"other public runtime", "runc", "true", "true", false},
		{"unknown runtime", "other", "false", "true", false},
		{"runtime whitespace", "runsc ", "false", "true", false},
		{"invalid enabled", "", "false", "yes", false},
		{"empty enabled", "", "false", "", false},
		{"invalid requirement", "runsc", "1", "true", false},
		{"empty requirement", "runsc", "", "true", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("RUNNER_RUNTIME", tc.runtime)
			t.Setenv("RUNNER_REQUIRE_GVISOR", tc.required)
			t.Setenv("RUNNER_ENABLED", tc.enabled)
			config, err := loadRunnerConfig()
			if (err == nil) != tc.valid {
				t.Fatalf("config=%+v err=%v", config, err)
			}
			if tc.valid && config != (runnerConfig{runtime: tc.runtime, requireGvisor: tc.required == "true", enabled: tc.enabled == "true"}) {
				t.Fatalf("incorrect config: %+v", config)
			}
		})
	}
}

func TestDockerRuntimeSelection(t *testing.T) {
	input := request{Mode: "test", Optimization: "race"}
	for _, runtime := range []string{"", "runsc"} {
		args := dockerArgs("job", "image", runtime, "execute", input)
		index := slices.Index(args, "--runtime")
		if runtime == "" && index != -1 {
			t.Fatal("default runtime should not add a runtime flag")
		}
		if runtime == "runsc" && (index < 0 || args[index+1] != "runsc" || index >= slices.Index(args, "image")) {
			t.Fatalf("runtime must be a Docker option before the image: %v", args)
		}
		if !slices.Equal(args[len(args)-4:], []string{"image", "execute", "test", "race"}) {
			t.Fatalf("runner protocol changed: %v", args)
		}
	}
}

func apiRequest(a *app, path, client string) *httptest.ResponseRecorder {
	method := http.MethodPost
	if path == "/api/version" || path == "/api/health" || path == "/" {
		method = http.MethodGet
	}
	r := httptest.NewRequest(method, path, strings.NewReader(`{"code":"package main"}`))
	r.Header.Set("Content-Type", "application/json")
	r.RemoteAddr = "127.0.0.1:5000"
	r.Header.Set("X-Forwarded-For", client)
	w := httptest.NewRecorder()
	a.ServeHTTP(w, r)
	return w
}

func TestDisableSwitchAndHealth(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("course"), 0600); err != nil {
		t.Fatal(err)
	}
	fake := &fakeRunner{result: result{Success: true, Stdout: "go version go1.27.4 linux/amd64"}}
	a := testApp(fake, root)
	a.config = runnerConfig{enabled: true, runtime: "runsc", requireGvisor: true}
	checkHealth := func(enabled bool) {
		t.Helper()
		w := apiRequest(a, "/api/health", "192.0.2.1")
		var health map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &health); err != nil {
			t.Fatal(err)
		}
		if w.Code != 200 || health["status"] != "ok" || health["runnerEnabled"] != enabled || health["runnerRuntime"] != "runsc" || health["runnerRequiresGvisor"] != true {
			t.Fatalf("health: %d %s", w.Code, w.Body)
		}
	}
	checkHealth(true)
	if w := apiRequest(a, "/api/version", "192.0.2.1"); w.Code != 200 {
		t.Fatalf("prime cache: %d %s", w.Code, w.Body)
	}
	if err := os.WriteFile(a.disabledFile, nil, 0600); err != nil {
		t.Fatal(err)
	}
	checkHealth(false)
	for _, path := range []string{"/api/execute", "/api/format", "/api/version"} {
		if w := apiRequest(a, path, "192.0.2.1"); w.Code != 503 {
			t.Fatalf("disabled %s: %d", path, w.Code)
		}
	}
	if fake.calls != 1 || len(a.jobStarts) != 1 {
		t.Fatal("disabled requests must not run or consume job quota")
	}
	if w := apiRequest(a, "/", "192.0.2.1"); w.Code != 200 {
		t.Fatalf("static unavailable: %d", w.Code)
	}
	if err := os.Remove(a.disabledFile); err != nil {
		t.Fatal(err)
	}
	checkHealth(true)
	if w := apiRequest(a, "/api/execute", "192.0.2.1"); w.Code != 200 || fake.calls != 2 {
		t.Fatal("removing marker did not re-enable jobs")
	}
	a.config.enabled = false
	checkHealth(false)
	if w := apiRequest(a, "/api/execute", "192.0.2.1"); w.Code != 503 {
		t.Fatal("startup disable ignored")
	}
}

func TestDisableSwitchFailsClosed(t *testing.T) {
	root := t.TempDir()
	fake := &fakeRunner{}
	a := testApp(fake, root)
	a.disabledFile = filepath.Join(root, "runner-disabled\x00")
	for _, path := range []string{"/api/health", "/api/execute", "/api/version"} {
		if w := apiRequest(a, path, "192.0.2.1"); w.Code != 503 {
			t.Fatalf("unreadable disable path did not fail closed: %s %d", path, w.Code)
		}
	}
	if fake.calls != 0 {
		t.Fatal("runner invoked with unreadable disable switch")
	}
}

func TestSharedJobQuotaAndVersionCache(t *testing.T) {
	fake := &fakeRunner{result: result{Success: true, Stdout: "go version go1.27.4 linux/amd64"}}
	a := testApp(fake, t.TempDir())
	a.trustForwarded = true
	for i := range maxJobsPerHour {
		path := "/api/execute"
		if i == 0 {
			path = "/api/version"
		} else if i%2 == 0 {
			path = "/api/format"
		}
		if w := apiRequest(a, path, fmt.Sprintf("192.0.2.%d", i+1)); w.Code != 200 {
			t.Fatalf("job %d: %d %s", i, w.Code, w.Body)
		}
	}
	w := apiRequest(a, "/api/execute", "198.51.100.1")
	retry, err := strconv.Atoi(w.Header().Get("Retry-After"))
	if w.Code != 429 || err != nil || retry < 1 || retry > 3600 || fake.calls != maxJobsPerHour {
		t.Fatalf("shared quota: %d retry=%d calls=%d", w.Code, retry, fake.calls)
	}
	for _, path := range []string{"/api/health", "/api/version"} {
		if w := apiRequest(a, path, "198.51.100.1"); w.Code != 200 || fake.calls != maxJobsPerHour {
			t.Fatalf("cached metadata/health consumed quota: %s %d", path, w.Code)
		}
	}
	a.versionExpires = time.Now().Add(-time.Second)
	if w := apiRequest(a, "/api/version", "198.51.100.1"); w.Code != 429 {
		t.Fatal("expired metadata cache bypassed quota")
	}
	a.jobStarts[0] = time.Now().Add(-time.Hour)
	if w := apiRequest(a, "/api/version", "198.51.100.1"); w.Code != 200 || fake.calls != maxJobsPerHour+1 {
		t.Fatal("rolling quota did not expire oldest job")
	}
}

type runnerFunc func(context.Context, string, request) (result, error)

func (f runnerFunc) run(ctx context.Context, operation string, input request) (result, error) {
	return f(ctx, operation, input)
}

func TestConcurrentJobsUseTrustedClientAndReleasePermits(t *testing.T) {
	started := make(chan struct{}, 4)
	finish := make(chan struct{})
	fake := runnerFunc(func(context.Context, string, request) (result, error) {
		started <- struct{}{}
		<-finish // Includes any runner cleanup before returning.
		return result{}, errors.New("runner failed")
	})
	a := testApp(fake, t.TempDir())
	a.trustForwarded = true
	done := make(chan *httptest.ResponseRecorder, 4)
	for i := range 4 {
		go func() { done <- apiRequest(a, "/api/execute", fmt.Sprintf("192.0.2.%d", i+1)) }()
		select {
		case <-started:
		case <-time.After(5 * time.Second):
			t.Fatal("runner did not start")
		}
		w := apiRequest(a, "/api/format", fmt.Sprintf("203.0.113.99, 192.0.2.%d", i+1))
		if w.Code != 429 || w.Header().Get("Retry-After") != "40" {
			t.Fatalf("client bypassed active job limit: %d %s", w.Code, w.Body)
		}
	}
	if w := apiRequest(a, "/api/execute", "198.51.100.1"); w.Code != 503 {
		t.Fatalf("global concurrency limit: %d", w.Code)
	}
	close(finish)
	for range 4 {
		if w := <-done; w.Code != 503 {
			t.Fatalf("runner error: %d", w.Code)
		}
	}
	if len(a.slots) != 0 || len(a.activeIPs) != 0 || len(a.jobStarts) != 4 {
		t.Fatal("permits leaked or rejected requests consumed quota")
	}
	if w := apiRequest(a, "/api/execute", "192.0.2.1"); w.Code != 503 || !strings.Contains(w.Body.String(), "runner failed") || len(a.jobStarts) != 5 {
		t.Fatal("client permit not released after error")
	}
}
