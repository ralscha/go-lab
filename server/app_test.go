package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

type fakeRunner struct {
	calls     int
	operation string
	input     request
	result    result
	err       error
}

func (f *fakeRunner) run(_ context.Context, operation string, input request) (result, error) {
	f.calls++
	f.operation = operation
	f.input = input
	return f.result, f.err
}
func post(a http.Handler, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("POST", "/api/execute", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	a.ServeHTTP(w, r)
	return w
}
func TestRejectInvalidRequestsBeforeExecution(t *testing.T) {
	for _, tc := range []struct{ name, body string }{
		{"empty", `{"code":" "}`}, {"mode", `{"code":"x","mode":"shell"}`},
		{"build", `{"code":"x","optimization":"unsafe"}`}, {"unknown", `{"code":"x","image":"other"}`},
		{"trailing", `{"code":"x"} {}`}, {"null", `null`}, {"wrong type", `{"code":3}`},
		{"source limit", fmt.Sprintf(`{"code":%q}`, strings.Repeat("a", maxSource+1))},
	} {
		t.Run(tc.name, func(t *testing.T) {
			runner := &fakeRunner{}
			w := post(testApp(runner, t.TempDir()), tc.body)
			if w.Code != 400 || runner.calls != 0 {
				t.Fatalf("status=%d calls=%d", w.Code, runner.calls)
			}
		})
	}
}
func TestValidRequestAndDiagnostics(t *testing.T) {
	runner := &fakeRunner{result: result{Success: false, Stderr: "syntax error"}}
	w := post(testApp(runner, t.TempDir()), `{"code":"package main"}`)
	if w.Code != 200 || runner.calls != 1 || runner.input.Mode != "run" || runner.input.Optimization != "default" {
		t.Fatalf("status=%d runner=%+v", w.Code, runner)
	}
	var output result
	if err := json.Unmarshal(w.Body.Bytes(), &output); err != nil {
		t.Fatal(err)
	}
	if output.Success || output.Stderr != "syntax error" {
		t.Fatalf("%+v", output)
	}
}
func TestOriginAndMediaType(t *testing.T) {
	for _, tc := range []struct {
		name, origin, media string
		want                int
	}{
		{"foreign", "https://untrusted.example", "application/json", 403},
		{"plain", "", "text/plain", 400},
		{"local", "http://localhost:4201", "application/json", 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			runner := &fakeRunner{result: result{Success: true}}
			a := testApp(runner, t.TempDir())
			r := httptest.NewRequest("POST", "/api/execute", strings.NewReader(`{"code":"x"}`))
			r.Header.Set("Origin", tc.origin)
			r.Header.Set("Content-Type", tc.media)
			w := httptest.NewRecorder()
			a.ServeHTTP(w, r)
			if w.Code != tc.want {
				t.Fatalf("status=%d", w.Code)
			}
		})
	}
}
func TestFormatFailurePreservesSource(t *testing.T) {
	a := testApp(&fakeRunner{result: result{Success: false, Stderr: "parse error"}}, t.TempDir())
	r := httptest.NewRequest("POST", "/api/format", strings.NewReader(`{"code":"broken source"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	a.ServeHTTP(w, r)
	var output result
	if err := json.Unmarshal(w.Body.Bytes(), &output); err != nil {
		t.Fatal(err)
	}
	if output.Code != "broken source" || output.Success {
		t.Fatalf("%+v", output)
	}
}
func TestLimitsAndUnavailableRunner(t *testing.T) {
	runner := &fakeRunner{err: fmt.Errorf("unavailable")}
	a := testApp(runner, t.TempDir())
	if w := post(a, `{"code":"x"}`); w.Code != 503 {
		t.Fatalf("status=%d", w.Code)
	}
	for i := 0; i < cap(a.slots); i++ {
		a.slots <- struct{}{}
	}
	if w := post(a, `{"code":"x"}`); w.Code != 503 || runner.calls != 1 {
		t.Fatalf("admission: %d calls=%d", w.Code, runner.calls)
	}
	b := testApp(&fakeRunner{}, t.TempDir())
	for range 30 {
		post(b, `{"code":"x"}`)
	}
	if w := post(b, `{"code":"x"}`); w.Code != 429 {
		t.Fatalf("rate limit: %d", w.Code)
	}
	if w := post(testApp(&fakeRunner{}, t.TempDir()), `{"code":"`+strings.Repeat("a", 70<<10)+`"}`); w.Code != 413 {
		t.Fatalf("body limit: %d", w.Code)
	}
}
func TestStaticAndUnknownAPI(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("Go course"), 0600); err != nil {
		t.Fatal(err)
	}
	a := testApp(&fakeRunner{}, root)
	for _, tc := range []struct {
		path   string
		status int
	}{{"/", 200}, {"/missing.js", 404}, {"/api/missing", 404}, {"/../go.mod", 404}, {"/api/health", 200}} {
		r := httptest.NewRequest("GET", tc.path, nil)
		w := httptest.NewRecorder()
		a.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Errorf("%s: %d", tc.path, w.Code)
		}
	}
}
func TestOutputLimitAcrossStreams(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	capture := &outputCapture{remaining: 10, cancel: cancel}
	var wg sync.WaitGroup
	for _, stderr := range []bool{false, true} {
		wg.Go(func() {
			_, _ = (outputWriter{capture: capture, stderr: stderr}).Write([]byte("123456789"))
		})
	}
	wg.Wait()
	if !capture.overflow || capture.stdout.Len()+capture.stderr.Len() != 10 || ctx.Err() == nil {
		t.Fatal("output limit did not cancel and bound combined output")
	}
}
func TestDockerIsolationArguments(t *testing.T) {
	args := strings.Join(dockerArgs("job", "image", "execute", request{Mode: "test", Optimization: "race"}), " ")
	for _, flag := range []string{"--network=none", "--read-only", "--user=10001:10001", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pull=never", "--pids-limit=128", "--log-driver=none"} {
		if !strings.Contains(args, flag) {
			t.Errorf("missing %s", flag)
		}
	}
	if strings.Contains(args, "--volume") || strings.Contains(args, "--privileged") {
		t.Fatal("unsafe runner mount or privilege")
	}
}

func testApp(r runner, root string) *app {
	a := newApp(r, root)
	a.origins["http://example.com"] = true
	return a
}

func TestRejectReboundHost(t *testing.T) {
	a := newApp(&fakeRunner{}, t.TempDir())
	r := httptest.NewRequest("GET", "http://rebound.example/api/health", nil)
	r.Header.Set("Origin", "http://rebound.example")
	w := httptest.NewRecorder()
	a.ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("untrusted host accepted: %d", w.Code)
	}
}
