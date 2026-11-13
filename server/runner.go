package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"
)

const outputLimit = 1 << 20
const startupMarker = "GO_LAB_RUNNER_READY\n"

type dockerRunner struct{ image string }
type outputCapture struct {
	mu             sync.Mutex
	stdout, stderr bytes.Buffer
	remaining      int
	overflow       bool
	cancel         context.CancelFunc
}
type outputWriter struct {
	capture *outputCapture
	stderr  bool
}

func (w outputWriter) Write(p []byte) (int, error) {
	c := w.capture
	c.mu.Lock()
	defer c.mu.Unlock()
	count := len(p)
	keep := min(count, c.remaining)
	if w.stderr {
		c.stderr.Write(p[:keep])
	} else {
		c.stdout.Write(p[:keep])
	}
	c.remaining -= keep
	if keep < count {
		c.overflow = true
		c.cancel()
	}
	return count, nil
}
func dockerArgs(name, image, operation string, input request) []string {
	return []string{"run", "--rm", "--pull=never", "--name", name, "--interactive",
		"--network=none", "--read-only", "--user=10001:10001", "--cap-drop=ALL",
		"--security-opt=no-new-privileges", "--cpus=1", "--memory=768m", "--memory-swap=768m",
		"--pids-limit=128", "--ulimit=nofile=256:256", "--ulimit=fsize=67108864:67108864",
		"--ipc=none", "--log-driver=none",
		"--tmpfs=/work:rw,exec,nosuid,nodev,size=268435456,mode=1777",
		"--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=67108864,mode=1777",
		image, operation, input.Mode, input.Optimization}
}
func (d *dockerRunner) run(ctx context.Context, operation string, input request) (result, error) {
	start := time.Now()
	name := fmt.Sprintf("go-lab-%x", randomID())
	job, cancel := context.WithCancel(ctx)
	defer cancel()
	capture := &outputCapture{remaining: outputLimit, cancel: cancel}
	cmd := exec.CommandContext(job, "docker", dockerArgs(name, d.image, operation, input)...)
	cmd.Stdin = strings.NewReader(input.Code)
	cmd.Stdout = outputWriter{capture: capture}
	cmd.Stderr = outputWriter{capture: capture, stderr: true}
	cmd.WaitDelay = 2 * time.Second
	err := cmd.Run()
	// Always remove by a unique server-generated name. Keep the admission slot until cleanup ends.
	cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	remove := exec.CommandContext(cleanup, "docker", "rm", "--force", name)
	_ = remove.Run()
	stdout, stderr := capture.stdout.String(), capture.stderr.String()
	ready := strings.Contains(stderr, startupMarker)
	stderr = strings.Replace(stderr, startupMarker, "", 1)
	output := result{Success: err == nil, Stdout: stdout, Stderr: stderr, ElapsedMS: time.Since(start).Milliseconds()}
	if capture.overflow {
		output.Success = false
		output.Stderr += "\nOutput exceeded the 1 MiB limit."
		return output, nil
	}
	if ctx.Err() != nil {
		output.Success = false
		output.Stderr += "\nExecution cancelled or exceeded the 35-second deadline."
		return output, nil
	}
	if err != nil && !ready {
		return result{}, errors.New("Go runner unavailable. Start Docker with Linux containers and run npm run runner:build")
	}
	if exit := new(exec.ExitError); errors.As(err, &exit) && exit.ExitCode() == 124 {
		output.Stderr += "\nExecution exceeded the 30-second limit."
	}
	return output, nil
}
func randomID() []byte {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return value
}
