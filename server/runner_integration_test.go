package main

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func TestDockerIntegration(t *testing.T) {
	if os.Getenv("GO_LAB_DOCKER_TEST") != "1" {
		t.Skip("set GO_LAB_DOCKER_TEST=1 to test the built runner image")
	}
	config, err := loadRunnerConfig()
	if err != nil {
		t.Fatal(err)
	}
	runner := &dockerRunner{image: env("RUNNER_IMAGE", "go-lab-runner:1.27.4"), runtime: config.runtime}
	for _, tc := range []struct {
		name, operation, mode, build, code, contains string
		success                                      bool
	}{
		{"version", "version", "", "", "", "go1.27.4", true},
		{"format", "format", "", "", "package main\nfunc main(){println(42)}", "func main() {", true},
		{"run", "execute", "run", "default", "package main\nimport \"fmt\"\nfunc main(){fmt.Println(42)}", "42", true},
		{"test", "execute", "test", "default", "package main\nimport \"testing\"\nfunc TestValue(t *testing.T){if 2+2!=4{t.Fatal(\"math\")}}", "PASS", true},
		{"race", "execute", "run", "race", "package main\nimport (\"fmt\";\"sync\")\nfunc main(){var w sync.WaitGroup;w.Add(1);go func(){defer w.Done();fmt.Println(42)}();w.Wait()}", "42", true},
		{"compile failure", "execute", "run", "default", "package main\nfunc main(){missing()}", "undefined", false},
		{"panic", "execute", "run", "default", "package main\nfunc main(){panic(\"intentional\")}", "intentional", false},
		{"readonly root", "execute", "run", "default", "package main\nimport (\"fmt\";\"os\")\nfunc main(){fmt.Println(os.Getuid());fmt.Println(os.WriteFile(\"/forbidden\",[]byte(\"x\"),0600)!=nil)}", "10001\ntrue", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
			defer cancel()
			out, err := runner.run(ctx, tc.operation, request{Code: tc.code, Mode: tc.mode, Optimization: tc.build})
			if err != nil {
				t.Fatal(err)
			}
			if out.Success != tc.success || !strings.Contains(out.Stdout+out.Stderr, tc.contains) {
				t.Fatalf("%+v", out)
			}
		})
	}
	t.Run("cancellation", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		out, err := runner.run(ctx, "execute", request{Code: "package main\nfunc main(){for {}}", Mode: "run", Optimization: "default"})
		if err != nil || out.Success || !strings.Contains(out.Stderr, "deadline") {
			t.Fatalf("%+v %v", out, err)
		}
	})
	t.Run("output limit", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
		defer cancel()
		out, err := runner.run(ctx, "execute", request{Code: "package main\nimport (\"fmt\";\"strings\")\nfunc main(){fmt.Print(strings.Repeat(\"x\",2<<20))}", Mode: "run", Optimization: "default"})
		if err != nil || out.Success || !strings.Contains(out.Stderr, "Output exceeded") {
			t.Fatalf("success=%v stderr=%q err=%v", out.Success, out.Stderr, err)
		}
	})
}
