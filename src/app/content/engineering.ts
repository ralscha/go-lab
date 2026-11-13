import type { CourseModule } from '../course.model';
const go = String.raw;

export const engineering: CourseModule = {
  id: 'engineering',
  title: 'Build useful programs',
  level: 'Advanced',
  description: 'Package boundaries, command-line parsing, HTTP handlers, and diagnostics.',
  lessons: [
    {
      id: 'package-design',
      title: 'Package boundaries and public APIs',
      summary: 'Separate domain logic from adapters and configuration.',
      minutes: 18,
      objectives: ['Design a small exported API', 'Keep dependencies explicit'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'Package names should communicate purpose. Export names that callers need, while keeping representation details private. A module can contain a command under cmd/ and supporting packages; internal/ restricts imports to the appropriate parent tree. Avoid import cycles by choosing a clear dependency direction.',
            'A useful architecture keeps parsing, filesystem access, and transport at the edges, with a small domain core that accepts ordinary values or narrow interfaces. Tests can then exercise the core without starting servers or creating real infrastructure.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Do not hide important initialization in init functions or mutable package globals. Constructors can validate required dependencies and make failures visible. A constructor is an ordinary function, not a special language feature.',
            'Interfaces are most useful at real substitution boundaries. Keep packages cohesive rather than creating a package for every type. The one-file example demonstrates the boundary through functions; a local project can place the pieces in separate directories.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"strings"
)

func NormalizeName(input string) (string, error) {

	name := strings.TrimSpace(input)

	if name == "" {

		return "", fmt.Errorf("name is empty")

	}

	return name, nil

}
func main() {

	name, err := NormalizeName(" Ada ")

	if err != nil {

		panic(err)

	}

	fmt.Println(name)

}
`,
      expectedOutput: 'Ada',
      exercise: {
        prompt: 'Reject a name that becomes empty after trimming.',
        hint: 'Validate the normalized value.',
        solution: go`package main

import (
	"fmt"
	"strings"
)

func ValidName(input string) bool {
	return strings.TrimSpace(input) != ""

}
func main() {
	fmt.Println(ValidName("   "))
	fmt.Println(ValidName(" Ada "))

}
`,
        starter: go`package main

import (
	"fmt"
	"strings"
)

func ValidName(input string) bool {
	return strings.TrimSuffix(input, "!") != ""

}
func main() {
	fmt.Println(ValidName("   "))
	fmt.Println(ValidName(" Ada "))

}
`,
        expectedOutput: 'false\ntrue',
      },
      quiz: {
        question: 'Where should an interface usually be defined?',
        options: [
          'In every package automatically',
          'Only in main',
          'Near the code consuming the behavior',
        ],
        answer: 2,
        explanation:
          'Consumer-defined small interfaces express the behavior actually needed at a boundary.',
      },
      references: [
        {
          label: 'Module layout',
          url: 'https://go.dev/doc/modules/layout',
        },
        {
          label: 'Package names',
          url: 'https://go.dev/blog/package-names',
        },
      ],
      tags: ['packages', 'internal', 'architecture'],
    },
    {
      id: 'command-line',
      title: 'Command-line flags and configuration',
      summary: 'Parse inputs without mixing them into business logic.',
      minutes: 18,
      objectives: ['Use an isolated flag.FlagSet', 'Validate parsed options'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'The flag package parses command-line options into typed values. An independent FlagSet with ContinueOnError makes parsing testable without terminating the process. Parse the argument slice explicitly and separate option parsing from the work it configures.',
            'Defaults are part of the interface. After parsing, validate combinations and ranges; an integer flag can still be negative. At the process boundary, report a useful message and choose an exit status.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Global flag state makes tests harder to isolate. Accept io.Writer for diagnostics or use a fresh FlagSet in each test. Do not call os.Exit deep inside reusable functions because it prevents caller recovery and skips defers.',
            'The playground supplies fixed arguments within source so it remains noninteractive. For a real command, feed os.Args[1:] into the same parser and keep the core unchanged.',
          ],
        },
      ],
      example: go`package main

import (
	"flag"
	"fmt"
	"io"
)

func main() {

	flags := flag.NewFlagSet("greet", flag.ContinueOnError)

	flags.SetOutput(io.Discard)

	name := flags.String("name", "world", "name to greet")

	if err := flags.Parse([]string{"-name", "Ada"}); err != nil {

		panic(err)

	}

	fmt.Println("Hello,", *name)

}
`,
      expectedOutput: 'Hello, Ada',
      exercise: {
        prompt: 'Use the parsed count rather than a hard-coded value.',
        hint: 'Read the pointer returned by Int.',
        solution: go`package main

import (
	"flag"
	"fmt"
)

func main() {

	flags := flag.NewFlagSet("count", flag.ContinueOnError)

	count := flags.Int("count", 1, "repetitions")

	if err := flags.Parse([]string{"-count", "3"}); err != nil {

		panic(err)

	}

	_ = count

	fmt.Println(*count)

}
`,
        starter: go`package main

import (
	"flag"
	"fmt"
)

func main() {

	flags := flag.NewFlagSet("count", flag.ContinueOnError)

	count := flags.Int("count", 1, "repetitions")

	if err := flags.Parse([]string{"-count", "3"}); err != nil {

		panic(err)

	}

	_ = count

	fmt.Println(1)

}
`,
        expectedOutput: '3',
      },
      quiz: {
        question: 'Why use ContinueOnError in a reusable parser?',
        options: [
          'It returns errors to the caller',
          'It ignores invalid arguments',
          'It always exits the process',
        ],
        answer: 0,
        explanation: 'The caller retains control over reporting and process exit.',
      },
      references: [
        {
          label: 'flag',
          url: 'https://pkg.go.dev/flag',
        },
        {
          label: 'os',
          url: 'https://pkg.go.dev/os',
        },
      ],
      tags: ['CLI', 'flag', 'configuration'],
    },
    {
      id: 'http',
      title: 'HTTP handlers and in-memory tests',
      summary: 'Build and test an endpoint without opening a socket.',
      minutes: 18,
      objectives: ['Implement http.Handler', 'Assert status, headers, and response bodies'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'An HTTP handler accepts a ResponseWriter and a Request. Set headers before writing the status or body. net/http.ServeMux routes requests, including method-aware patterns. Keep request parsing and response mapping around a testable core.',
            'httptest.NewRecorder and httptest.NewRequest invoke handlers entirely in memory. This works in the network-disabled playground. A deployed server additionally needs explicit timeouts, body limits, graceful shutdown, and appropriate access controls.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Writing a body implicitly sends status 200 if no status was sent. Check input before beginning a success response. Bound JSON bodies with http.MaxBytesReader, inspect decode errors, and validate the domain model.',
            'For outbound calls, use a client with timeouts and a request context, close response bodies, and check status codes. An HTTP error status is not necessarily a transport error.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
)

func main() {

	mux := http.NewServeMux()

	mux.HandleFunc("GET /hello", func(w http.ResponseWriter, r *http.Request) {

		w.Header().Set("Content-Type", "text/plain")

		fmt.Fprintln(w, "Hello, Go!")

	})

	response := httptest.NewRecorder()

	mux.ServeHTTP(response, httptest.NewRequest("GET", "/hello", nil))

	fmt.Println(response.Code)

	fmt.Print(response.Body.String())

}
`,
      expectedOutput: '200\nHello, Go!',
      exercise: {
        prompt: 'Return 201 Created when creating an item.',
        hint: 'Write the status before the response body.',
        solution: go`package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
)

func create(w http.ResponseWriter, r *http.Request) {

	w.WriteHeader(http.StatusCreated)

	fmt.Fprint(w, "created")

}
func main() {

	response := httptest.NewRecorder()

	create(response, httptest.NewRequest("POST", "/items", nil))

	fmt.Println(response.Code, response.Body.String())

}
`,
        starter: go`package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
)

func create(w http.ResponseWriter, r *http.Request) {
	/* TODO: set the creation status*/
	fmt.Fprint(w, "created")

}
func main() {

	response := httptest.NewRecorder()

	create(response, httptest.NewRequest("POST", "/items", nil))

	fmt.Println(response.Code, response.Body.String())

}
`,
        expectedOutput: '201 created',
      },
      quiz: {
        question: 'When should response headers be set?',
        options: [
          'After the entire body',
          'Before writing the status or body',
          'Only in a goroutine',
        ],
        answer: 1,
        explanation: 'The first header/body write commits the response headers.',
      },
      references: [
        {
          label: 'net/http',
          url: 'https://pkg.go.dev/net/http',
        },
        {
          label: 'net/http/httptest',
          url: 'https://pkg.go.dev/net/http/httptest',
        },
      ],
      tags: ['HTTP', 'handlers', 'httptest'],
    },
    {
      id: 'http-lifecycle',
      title: 'HTTP clients, timeouts, and shutdown',
      summary: 'Bound request lifetimes and stop servers without abandoning work.',
      minutes: 20,
      objectives: [
        'Set client and server timeouts intentionally',
        'Shut down an HTTP server with a deadline',
      ],
      sections: [
        {
          title: 'Bound client requests',
          body: [
            'Give an http.Client a timeout as a final bound and create each outbound request with a context tied to its caller. Close every response body and inspect the status code: a non-2xx response is still a successful HTTP exchange, not a Do error. Reuse clients and transports so connection pooling remains effective.',
            'Tests can exercise both a handler and client code without opening a socket by supplying a small custom RoundTripper that invokes the handler in memory. The runnable example uses that pattern; it demonstrates request/response behavior but does not replace tests against a real server.',
          ],
        },
        {
          title: 'Serve and shut down',
          body: [
            'Configure an http.Server with at least ReadHeaderTimeout, and choose read, write, and idle timeouts appropriate to the application. Start ListenAndServe under a process-level lifecycle that observes termination signals. On shutdown, call Server.Shutdown with a bounded context so active requests can finish; handle http.ErrServerClosed as the normal result.',
            'A shutdown deadline does not guarantee every handler has finished. Decide what to do if the deadline expires, stop accepting new work, and ensure background goroutines also have cancellation and completion signals. Do not use a sleep as a substitute for coordinated shutdown.',
          ],
          code: 'ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)\\ndefer stop()\\n<-ctx.Done()\\nshutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)\\ndefer cancel()\\nif err := server.Shutdown(shutdownCtx); err != nil {\\n    return err\\n}',
        },
      ],
      example: go`package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"time"
)

type handlerTransport struct {
	handler http.Handler
}

func (t handlerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	recorder := httptest.NewRecorder()
	t.handler.ServeHTTP(recorder, req)
	return recorder.Result(), nil
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "ok")
	})
	server := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	client := &http.Client{
		Transport: handlerTransport{handler: server.Handler},
		Timeout:   2 * time.Second,
	}
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example.test/health", nil)
	if err != nil {
		panic(err)
	}
	response, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		panic(err)
	}
	fmt.Println(response.StatusCode)
	fmt.Print(string(body))
}
`,
      expectedOutput: '200\nok',
      exercise: {
        prompt: 'Treat only 2xx response codes as successful.',
        hint: 'HTTP status codes from 200 through 299 are successful responses.',
        starter: go`package main

import "fmt"

func successful(status int) bool {
	return status < 400
}

func main() {
	for _, status := range []int{200, 201, 404} {
		fmt.Println(successful(status))
	}
}
`,
        solution: go`package main

import "fmt"

func successful(status int) bool {
	return status >= 200 && status < 300
}

func main() {
	for _, status := range []int{200, 201, 404} {
		fmt.Println(successful(status))
	}
}
`,
        expectedOutput: 'true\ntrue\nfalse',
      },
      quiz: {
        question: 'Does client.Do return an error for an HTTP 404 response?',
        options: [
          'Yes, for every non-2xx response',
          'No, check the response status explicitly',
          'Only when the body is empty',
        ],
        answer: 1,
        explanation:
          'Do errors report request/transport failures; an HTTP status such as 404 is a response to inspect.',
      },
      references: [
        {
          label: 'net/http',
          url: 'https://pkg.go.dev/net/http',
        },
        {
          label: 'Graceful shutdown',
          url: 'https://pkg.go.dev/net/http#Server.Shutdown',
        },
        {
          label: 'signal.NotifyContext',
          url: 'https://pkg.go.dev/os/signal#NotifyContext',
        },
      ],
      tags: ['HTTP', 'timeouts', 'client', 'shutdown', 'context'],
    },
    {
      id: 'diagnostics',
      title: 'Structured logs and profiling',
      summary: 'Observe behavior with useful context and bounded overhead.',
      minutes: 18,
      objectives: ['Use structured slog records', 'Choose a diagnostic tool based on evidence'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'log/slog records a message with structured attributes and a level. Inject a logger or handler when tests need predictable output. Stable attribute names let tools search by operation, status, or request identifier rather than parsing prose.',
            'Use CPU profiles for where execution spends time, heap profiles for allocation/retention, and traces for scheduling and blocking behavior. Start from an observed question and collect representative data before changing code.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Do not log secrets or entire unbounded request bodies. Errors should be recorded at a useful boundary with enough context to act, avoiding duplicate logs at every layer. Logging itself consumes time and storage.',
            'The race detector, vet, profiles, and tests answer different questions. Unsafe pointers, reflection, cgo, and database drivers introduce further contracts; study their official documentation when a concrete project requires them rather than bypassing the type system prematurely.',
          ],
        },
      ],
      example: go`package main

import (
	"bytes"
	"fmt"
	"log/slog"
)

func main() {

	var output bytes.Buffer

	logger := slog.New(slog.NewTextHandler(&output, &slog.HandlerOptions{ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {

		if a.Key == slog.TimeKey {

			return slog.Attr{}

		}

		return a

	}}))

	logger.Info("completed", "count", 3)

	fmt.Print(output.String())

}
`,
      expectedOutput: 'level=INFO msg=completed count=3',
      exercise: {
        prompt: 'Record the task count under a stable count attribute.',
        hint: 'Replace the attribute key, leaving the numeric value intact.',
        solution: go`package main

import (
	"bytes"
	"fmt"
	"log/slog"
	"strings"
)

func main() {

	var output bytes.Buffer

	logger := slog.New(slog.NewJSONHandler(&output, nil))

	logger.Info("done", "count", 3)

	fmt.Println(strings.Contains(output.String(), "\"count\":3"))

}
`,
        starter: go`package main

import (
	"bytes"
	"fmt"
	"log/slog"
	"strings"
)

func main() {

	var output bytes.Buffer

	logger := slog.New(slog.NewJSONHandler(&output, nil))

	logger.Info("done", "items", 3)

	fmt.Println(strings.Contains(output.String(), "\"count\":3"))

}
`,
        expectedOutput: 'true',
      },
      quiz: {
        question: 'Which evidence helps locate CPU-intensive code?',
        options: [
          'The shortest source file',
          'A single log timestamp',
          'A representative CPU profile',
        ],
        answer: 2,
        explanation:
          'CPU profiles attribute sampled execution time to code paths in the measured workload.',
      },
      references: [
        {
          label: 'log/slog',
          url: 'https://pkg.go.dev/log/slog',
        },
        {
          label: 'Diagnostics',
          url: 'https://go.dev/doc/diagnostics',
        },
        {
          label: 'Standard library',
          url: 'https://pkg.go.dev/std',
        },
      ],
      tags: ['slog', 'pprof', 'diagnostics', 'profiling'],
    },
  ],
};
