import type { CourseModule } from '../course.model';
const go = String.raw;

export const capstones: CourseModule = {
  id: 'capstones',
  title: 'Four practical capstones',
  level: 'Advanced',
  description: 'Combine parsing, text processing, HTTP boundaries, and concurrent pipelines.',
  lessons: [
    {
      id: 'capstone-parser',
      title: 'Build a validated record parser',
      summary: 'Turn untrusted text into a well-defined domain value.',
      minutes: 18,
      objectives: ['Separate syntax and domain validation', 'Preserve useful error context'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'Build a parser for name:score records. First locate the separator, then trim the name, parse the integer, and enforce the score range. Each phase has its own contract, and errors should identify the failed phase without exposing unrelated implementation details.',
            'Return a named struct only after validation succeeds. That gives later code a useful invariant: the name is nonempty and the score is in range. For repeated input, attach a line number at the outer layer rather than teaching the core parser about files.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Test missing separators, empty names, nonnumeric scores, negative scores, and both range boundaries. A successful sample is not enough to establish validation behavior. Do not silently replace malformed input with a plausible zero.',
            'Extend this into a local CLI by accepting an io.Reader, scanning bounded lines, and reporting all rejected records according to a documented policy. Keep output formatting separate from parsing so tests can assert domain values directly.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"strconv"
	"strings"
)

type Record struct {
	Name  string
	Score int
}

func Parse(text string) (Record, error) {

	name, raw, ok := strings.Cut(text, ":")

	if !ok {

		return Record{}, fmt.Errorf("missing separator")

	}

	name = strings.TrimSpace(name)

	if name == "" {

		return Record{}, fmt.Errorf("empty name")

	}

	score, err := strconv.Atoi(strings.TrimSpace(raw))

	if err != nil {

		return Record{}, fmt.Errorf("score: %w", err)

	}

	if score < 0 || score > 100 {

		return Record{}, fmt.Errorf("score out of range")

	}

	return Record{name, score}, nil

}
func main() {

	record, err := Parse(" Ada : 42 ")

	if err != nil {

		panic(err)

	}

	fmt.Println(record.Name, record.Score)

	_, err = Parse("Ada:101")

	fmt.Println(err)

}
`,
      expectedOutput: 'Ada 42\nscore out of range',
      exercise: {
        prompt: 'Complete the score range validation so the boundary tests pass.',
        hint: 'Both values outside 0..100 are invalid; the endpoints are valid.',
        solution: go`package main

import "fmt"

func ValidScore(score int) bool {
	return score >= 0 && score <= 100

}
func main() {

	for _, score := range []int{-1, 0, 100, 101} {

		fmt.Println(score, ValidScore(score))

	}

}
`,
        starter: go`package main

import "fmt"

func ValidScore(score int) bool {
	return score >= 0

}
func main() {

	for _, score := range []int{-1, 0, 100, 101} {

		fmt.Println(score, ValidScore(score))

	}

}
`,
        expectedOutput: '-1 false\n0 true\n100 true\n101 false',
      },
      quiz: {
        question: 'When should a validated Record be returned?',
        options: [
          'After syntax and domain checks pass',
          'Immediately after finding a colon',
          'Even when parsing fails',
        ],
        answer: 0,
        explanation: 'Callers should be able to rely on the invariants established by the parser.',
      },
      references: [
        {
          label: 'strconv',
          url: 'https://pkg.go.dev/strconv',
        },
        {
          label: 'strings.Cut',
          url: 'https://pkg.go.dev/strings#Cut',
        },
      ],
      tags: ['capstone', 'parser', 'validation'],
    },
    {
      id: 'capstone-text',
      title: 'Build a deterministic word report',
      summary: 'Combine readers, tokenization, maps, and stable ordering.',
      minutes: 18,
      objectives: ['Define a normalization policy', 'Separate counting from presentation'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A word report reads text, normalizes according to an explicit policy, counts tokens in a map, and renders sorted keys. Here a word is a whitespace-separated token converted to lowercase. Punctuation remains part of the token; that is a deliberate limited policy rather than a claim about natural-language words.',
            'Accept io.Reader to separate the algorithm from files, strings, and network responses. Use bufio.Scanner with ScanWords and check its error. Return the count map before deciding how to display it.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Tokenization policy changes results. Test punctuation, non-ASCII text, repeated whitespace, and empty input. Document size limits and choose scanner buffering deliberately for large tokens.',
            'Sorting makes visible output deterministic without depending on map iteration order. A useful extension is a flag-controlled case policy with tests for each mode. Keep CLI parsing at the edge so counting stays easy to reuse.',
          ],
        },
      ],
      example: go`package main

import (
	"bufio"
	"fmt"
	"io"
	"maps"
	"slices"
	"strings"
)

func Count(r io.Reader) (map[string]int, error) {

	counts := map[string]int{}

	scanner := bufio.NewScanner(r)

	scanner.Split(bufio.ScanWords)

	for scanner.Scan() {

		counts[strings.ToLower(scanner.Text())]++

	}

	return counts, scanner.Err()

}
func main() {

	counts, err := Count(strings.NewReader("Go makes code clear Go"))

	if err != nil {

		panic(err)

	}

	for _, word := range slices.Sorted(maps.Keys(counts)) {

		fmt.Println(word, counts[word])

	}

}
`,
      expectedOutput: 'clear 1\ncode 1\ngo 2\nmakes 1',
      exercise: {
        prompt: 'Normalize tokens before counting so both forms of Go share one key.',
        hint: 'Use strings.ToLower on each word.',
        solution: go`package main

import (
	"fmt"
	"strings"
)

func main() {

	counts := map[string]int{}

	for _, word := range strings.Fields("Go go GO") {

		counts[strings.ToLower(word)]++

	}

	fmt.Println(counts["go"])

}
`,
        starter: go`package main

import (
	"fmt"
	"strings"
)

func main() {

	counts := map[string]int{}

	for _, word := range strings.Fields("Go go GO") {

		counts[word]++

	}

	fmt.Println(counts["go"])

}
`,
        expectedOutput: '3',
      },
      quiz: {
        question: 'Why sort keys when rendering a map?',
        options: [
          'To make the map safe for concurrent writes',
          'To make presentation deterministic',
          'To remove duplicate values',
        ],
        answer: 1,
        explanation: 'Map traversal order is unspecified; sorted keys give a stable report.',
      },
      references: [
        {
          label: 'bufio.Scanner',
          url: 'https://pkg.go.dev/bufio#Scanner',
        },
        {
          label: 'strings.Fields',
          url: 'https://pkg.go.dev/strings#Fields',
        },
      ],
      tags: ['capstone', 'text', 'word count', 'sorting'],
    },
    {
      id: 'capstone-service',
      title: 'Build a tested JSON endpoint',
      summary: 'Enforce an HTTP contract around a small domain operation.',
      minutes: 18,
      objectives: [
        'Validate a request before responding',
        'Test invalid and successful HTTP requests',
      ],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'An endpoint should enforce its method, bound its request body, decode the expected representation, reject trailing JSON, validate the domain values, and only then produce a success response. Each layer translates one contract into the next.',
            'The example greets a validated name and returns JSON. httptest exercises the handler without a socket. Test the response code and decoded body, then add malformed JSON, unknown fields, empty names, and oversized body cases.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Set Content-Type before writing the body. Avoid returning raw internal errors to clients; reserve detailed diagnostics for a controlled logging boundary. Error status codes and response shapes should be consistent.',
            'For deployment, add server timeouts and graceful shutdown, then decide authentication, request admission, and storage policies for the actual use case. A passing in-memory handler test does not verify those operational properties.',
          ],
        },
      ],
      example: go`package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
)

func greet(w http.ResponseWriter, r *http.Request) {

	if r.Method != "POST" {

		w.Header().Set("Allow", "POST")

		http.Error(w, "method not allowed", 405)

		return

	}

	var input struct{ Name string }

	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))

	d.DisallowUnknownFields()

	if err := d.Decode(&input); err != nil {

		http.Error(w, "invalid JSON", 400)

		return

	}

	if err := d.Decode(new(any)); err != io.EOF {

		http.Error(w, "one value required", 400)

		return

	}

	name := strings.TrimSpace(input.Name)

	if name == "" {

		http.Error(w, "name required", 400)

		return

	}

	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]string{"greeting": "Hello, " + name})

}
func main() {

	response := httptest.NewRecorder()

	greet(response, httptest.NewRequest("POST", "/greet", strings.NewReader("{\"Name\":\"Ada\"}")))

	fmt.Println(response.Code)

	fmt.Print(response.Body.String())

}
`,
      expectedOutput: '200\n{"greeting":"Hello, Ada"}',
      exercise: {
        mode: 'test',
        prompt: 'Reject an empty name with 400 rather than returning success.',
        hint: 'The validation branch needs the bad-request status.',
        solution: go`package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func greet(w http.ResponseWriter, r *http.Request) {

	if r.URL.Query().Get("name") == "" {

		http.Error(w, "name required", http.StatusBadRequest)

		return

	}

	w.WriteHeader(http.StatusOK)

}
func TestGreet(t *testing.T) {

	for _, tc := range []struct {
		url  string
		want int
	}{{"/greet", 400}, {"/greet?name=Ada", 200}} {

		w := httptest.NewRecorder()

		greet(w, httptest.NewRequest("GET", tc.url, nil))

		if w.Code != tc.want {

			t.Errorf("%s: got %d, want %d", tc.url, w.Code, tc.want)

		}

	}

}
`,
        starter: go`package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func greet(w http.ResponseWriter, r *http.Request) {

	if r.URL.Query().Get("name") == "" {

		http.Error(w, "name required", http.StatusOK)

		return

	}

	w.WriteHeader(http.StatusOK)

}
func TestGreet(t *testing.T) {

	for _, tc := range []struct {
		url  string
		want int
	}{{"/greet", 400}, {"/greet?name=Ada", 200}} {

		w := httptest.NewRecorder()

		greet(w, httptest.NewRequest("GET", tc.url, nil))

		if w.Code != tc.want {

			t.Errorf("%s: got %d, want %d", tc.url, w.Code, tc.want)

		}

	}

}
`,
      },
      quiz: {
        question: 'Why decode again and require io.EOF?',
        options: [
          'To double the request size',
          'To reject trailing JSON values',
          'To enable network access',
        ],
        answer: 1,
        explanation:
          'A single Decode consumes only one value; a second check enforces the one-value contract.',
      },
      references: [
        {
          label: 'net/http',
          url: 'https://pkg.go.dev/net/http',
        },
        {
          label: 'encoding/json.Decoder',
          url: 'https://pkg.go.dev/encoding/json#Decoder',
        },
      ],
      tags: ['capstone', 'API', 'HTTP', 'JSON'],
    },
    {
      id: 'capstone-pipeline',
      title: 'Build a bounded worker pipeline',
      summary: 'Give each goroutine an owner, cancellation, and a completion signal.',
      minutes: 18,
      objectives: [
        'Bound concurrency with a worker pool',
        'Close results after all workers finish',
      ],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A worker pool starts a fixed number of goroutines, sends jobs through a channel, and gathers results through another. A WaitGroup joins workers. A coordinator closes the result channel only after every worker has stopped sending. The number of workers bounds concurrent work.',
            'A producer and each worker should honor cancellation while blocked on communication. The consumer must either drain results or cancel and wait for shutdown. Channel capacity alone does not establish a complete lifecycle.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Concurrent results can arrive in any order. Sort them or attach sequence numbers if order is part of the contract. Avoid unbounded goroutine creation for arbitrarily large inputs.',
            'Extend the example with errors and cancellation policy: should the first error cancel everything, or should independent jobs continue? Test early cancellation, empty input, and full completion with the race detector. Do not hide a leak behind a sleep.',
          ],
        },
      ],
      example: go`package main

import (
	"context"
	"fmt"
	"slices"
	"sync"
)

func squares(ctx context.Context, values []int) <-chan int {

	jobs := make(chan int)

	results := make(chan int)

	var wg sync.WaitGroup

	for i := 0; i < 2; i++ {

		wg.Add(1)

		go func() {

			defer wg.Done()

			for n := range jobs {

				select {

				case results <- n * n:

				case <-ctx.Done():

					return

				}

			}

		}()

	}

	go func() {

		defer close(jobs)

		for _, n := range values {

			select {

			case jobs <- n:

			case <-ctx.Done():

				return

			}

		}

	}()

	go func() {
		wg.Wait()
		close(results)

	}()

	return results

}
func main() {

	ctx, cancel := context.WithCancel(context.Background())

	defer cancel()

	var values []int

	for n := range squares(ctx, []int{3, 1, 2}) {

		values = append(values, n)

	}

	slices.Sort(values)

	fmt.Println(values)

}
`,
      expectedOutput: '[1 4 9]',
      exercise: {
        prompt: 'Wait for all workers before closing results.',
        hint: 'The coordinator must wait before close.',
        solution: go`package main

import (
	"fmt"
	"sync"
)

func main() {

	results := make(chan int)

	var wg sync.WaitGroup

	for i := 1; i <= 3; i++ {

		wg.Add(1)

		go func(n int) {
			defer wg.Done()
			results <- n

		}(i)

	}

	go func() {
		wg.Wait()
		close(results)

	}()

	total := 0

	for n := range results {

		total += n

	}

	fmt.Println(total)

}
`,
        starter: go`package main

import (
	"fmt"
	"sync"
)

func main() {

	results := make(chan int)

	var wg sync.WaitGroup

	for i := 1; i <= 3; i++ {

		wg.Add(1)

		go func(n int) {
			defer wg.Done()
			results <- n

		}(i)

	}

	go func() {
		close(results)
		wg.Wait()

	}()

	total := 0

	for n := range results {

		total += n

	}

	fmt.Println(total)

}
`,
        expectedOutput: '6',
      },
      quiz: {
        question: 'When can the coordinator close results?',
        options: [
          'As soon as the first worker finishes',
          'Whenever the channel is temporarily empty',
          'After all senders have finished',
        ],
        answer: 2,
        explanation:
          'Closing while a sender can still send causes a panic; join every sender first.',
      },
      references: [
        {
          label: 'Pipelines and cancellation',
          url: 'https://go.dev/blog/pipelines',
        },
        {
          label: 'Memory model',
          url: 'https://go.dev/ref/mem',
        },
      ],
      tags: ['capstone', 'pipeline', 'worker pool', 'concurrency'],
    },
  ],
};
