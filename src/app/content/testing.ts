import type { CourseModule } from '../course.model';
const go = String.raw;

export const testing: CourseModule = {
  id: 'testing',
  title: 'Test and measure',
  level: 'Intermediate',
  description: 'Table tests, executable examples, fuzz properties, and benchmarks.',
  lessons: [
    {
      id: 'table-tests',
      title: 'Table-driven tests and subtests',
      summary: 'Turn behavior contracts into readable cases.',
      minutes: 18,
      objectives: ['Write Test functions', 'Cover boundaries with named subtests'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'Tests live in files ending _test.go. A function named TestXxx accepts *testing.T. go test compiles the package with its test files and executes matching tests. Table-driven tests collect input/output cases and use t.Run for descriptive subtests.',
            'Choose cases around behavior boundaries: empty input, smallest valid input, ordinary input, and invalid input. A good test explains the contract without duplicating the implementation. t.Fatalf stops the current test when continuing would be meaningless.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Avoid asserting unstable details such as map traversal order or exact timestamps. Test values directly when possible. Use t.Helper in helpers so failure locations point to their callers, and t.Cleanup to register cleanup.',
            'Parallel tests share process state unless you isolate it. Keep temporary files in t.TempDir and avoid modifying global configuration concurrently. The playground Test mode treats the entire editor as main_test.go.',
          ],
        },
      ],
      example: go`package main

import "testing"

func Sum(values []int) int {

	n := 0

	for _, v := range values {

		n += v

	}

	return n

}
func TestSum(t *testing.T) {

	for _, tc := range []struct {
		name string
		in   []int
		want int
	}{{"empty", nil, 0}, {"positive", []int{2, 3}, 5}, {"negative", []int{-2, 1}, -1}} {

		t.Run(tc.name, func(t *testing.T) {

			if got := Sum(tc.in); got != tc.want {

				t.Fatalf("Sum=%d, want %d", got, tc.want)

			}

		})

	}

}
`,
      exercise: {
        prompt: 'Fix Abs so positive, negative, and zero cases pass.',
        hint: 'Negate only negative values.',
        solution: go`package main

import "testing"

func Abs(n int) int {

	if n < 0 {

		return -n

	}

	return n

}
func TestAbs(t *testing.T) {

	for _, tc := range []struct{ in, want int }{{-3, 3}, {0, 0}, {4, 4}} {

		if got := Abs(tc.in); got != tc.want {

			t.Errorf("Abs(%d)=%d, want %d", tc.in, got, tc.want)

		}

	}

}
`,
        starter: go`package main

import "testing"

func Abs(n int) int {

	if n > 0 {

		return -n

	}

	return n

}
func TestAbs(t *testing.T) {

	for _, tc := range []struct{ in, want int }{{-3, 3}, {0, 0}, {4, 4}} {

		if got := Abs(tc.in); got != tc.want {

			t.Errorf("Abs(%d)=%d, want %d", tc.in, got, tc.want)

		}

	}

}
`,
      },
      quiz: {
        question: 'What file suffix does go test discover?',
        options: ['.spec.ts', '_tests.txt', '_test.go'],
        answer: 2,
        explanation: 'Go discovers test source using the _test.go suffix.',
      },
      references: [
        {
          label: 'testing',
          url: 'https://pkg.go.dev/testing',
        },
      ],
      tags: ['testing', 'table tests', 'subtests'],
      mode: 'test',
    },
    {
      id: 'example-tests',
      title: 'Executable documentation',
      summary: 'Keep examples honest by testing their output.',
      minutes: 18,
      objectives: ['Write an Example function', 'Define stable observable output'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'An Example function can both document an API and verify its output. A trailing Output comment declares expected stdout. go test executes examples with output expectations and reports differences. Examples without output comments can be compiled without being executed.',
            'Choose examples that communicate one useful behavior. Use deterministic values and avoid network access, current time, or unstable ordering. Package documentation can display examples alongside exported APIs.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Output matching is appropriate for presentation contracts, but it should not replace direct assertions for every algorithm. Keep large test fixtures and complex failure cases in ordinary tests.',
            'Use an Unordered output comment only when order is intentionally irrelevant. Do not hide an ordering bug by changing the expectation policy. Test examples are still code and should check meaningful errors.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"strings"
)

func Example() {

	fmt.Println(strings.Join([]string{"go", "lab"}, "-"))
	// Output: go-lab

}
`,
      exercise: {
        prompt: 'Make the documented greeting match its executable contract.',
        hint: 'Change the implementation, keeping the Output expectation.',
        solution: go`package main

import "fmt"

func Greet(name string) string {
	return "Hello, " + name + "!"

}
func ExampleGreet() {

	fmt.Println(Greet("Ada"))
	// Output: Hello, Ada!

}
`,
        starter: go`package main

import "fmt"

func Greet(name string) string {
	return "Hi, " + name

}
func ExampleGreet() {

	fmt.Println(Greet("Ada"))
	// Output: Hello, Ada!

}
`,
      },
      quiz: {
        question: 'What makes an Example execute as an output test?',
        options: ['Its source file is empty', 'An Output expectation', 'It uses a goroutine'],
        answer: 1,
        explanation: 'An output comment declares the observable result that go test checks.',
      },
      references: [
        {
          label: 'Examples',
          url: 'https://pkg.go.dev/testing#hdr-Examples',
        },
      ],
      tags: ['examples', 'documentation', 'output tests'],
      mode: 'test',
    },
    {
      id: 'fuzzing',
      title: 'Fuzzing properties and seed cases',
      summary: 'Explore inputs beyond a hand-picked table.',
      minutes: 18,
      objectives: ['Define a property with Fuzz', 'Distinguish seed tests from fuzz campaigns'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A fuzz target accepts *testing.F, adds seed inputs with f.Add, and defines a callback with f.Fuzz. The callback checks a property that should hold across generated inputs. A useful property can be round-trip preservation, parser non-panicking behavior, or an invariant under normalization.',
            'Ordinary go test runs the seed corpus. A local campaign such as go test -fuzz=FuzzHex -fuzztime=10s actively generates inputs and saves failures for reproduction. The playground executes seeds only, keeping requests bounded.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'A property must actually hold for the API’s full input domain. Reversing bytes twice is different from reversing Unicode grapheme clusters. Limit input sizes when a valid but enormous input would consume too much time or memory.',
            'Fuzzing complements explicit boundary tests. A successful short campaign is evidence about explored cases, not proof over all inputs. Preserve discovered failures as regression cases.',
          ],
        },
      ],
      example: go`package main

import (
	"bytes"
	"encoding/hex"
	"testing"
)

func FuzzHex(f *testing.F) {

	f.Add([]byte("Go"))

	f.Add([]byte{})

	f.Fuzz(func(t *testing.T, input []byte) {

		encoded := hex.EncodeToString(input)

		decoded, err := hex.DecodeString(encoded)

		if err != nil || !bytes.Equal(input, decoded) {

			t.Fatal("round trip failed")

		}

	})

}
`,
      exercise: {
        prompt: 'Preserve all input bytes through a hex round trip.',
        hint: 'Do not alter decoded bytes before checking equality.',
        solution: go`package main

import (
	"bytes"
	"encoding/hex"
	"testing"
)

func RoundTrip(input []byte) []byte {

	output, err := hex.DecodeString(hex.EncodeToString(input))

	if err != nil {

		panic(err)

	}

	return output

}
func FuzzRoundTrip(f *testing.F) {

	f.Add([]byte("Go"))

	f.Add([]byte{})

	f.Fuzz(func(t *testing.T, input []byte) {

		if !bytes.Equal(input, RoundTrip(input)) {

			t.Fatal("bytes changed")

		}

	})

}
`,
        starter: go`package main

import (
	"bytes"
	"encoding/hex"
	"testing"
)

func RoundTrip(input []byte) []byte {

	output, err := hex.DecodeString(hex.EncodeToString(input))

	if err != nil {

		panic(err)

	}

	return append(output, 0)

}
func FuzzRoundTrip(f *testing.F) {

	f.Add([]byte("Go"))

	f.Add([]byte{})

	f.Fuzz(func(t *testing.T, input []byte) {

		if !bytes.Equal(input, RoundTrip(input)) {

			t.Fatal("bytes changed")

		}

	})

}
`,
      },
      quiz: {
        question: 'Does ordinary go test perform an unbounded fuzz campaign?',
        options: ['Yes', 'No, it runs seeds', 'Only on Windows'],
        answer: 1,
        explanation:
          'Active generation requires a -fuzz selection; regular testing executes the seed corpus.',
      },
      references: [
        {
          label: 'Fuzzing tutorial',
          url: 'https://go.dev/doc/tutorial/fuzz',
        },
        {
          label: 'Fuzzing',
          url: 'https://go.dev/doc/security/fuzz/',
        },
      ],
      tags: ['fuzz', 'properties', 'seed corpus'],
      mode: 'test',
    },
    {
      id: 'benchmarks',
      title: 'Benchmarks and allocation measurements',
      summary: 'Measure the operation you intend to improve.',
      minutes: 18,
      objectives: ['Write a Benchmark function', 'Keep correctness checks separate from timing'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'Benchmark functions accept *testing.B. The b.Loop method controls repeated measurement and helps keep setup outside timed iterations. Run go test -run=^$ -bench=. -benchmem locally to report timings and allocation counts. The playground Test mode compiles benchmarks but does not run a timing campaign.',
            'First establish correctness with tests. Then benchmark realistic sizes and compare repeated runs under similar conditions. Avoid printing in the measured loop, because I/O can dominate the operation being studied.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'One measurement is noisy. Compiler optimization, cache state, CPU frequency, and background load can change results. Do not claim an improvement from a tiny single-run difference.',
            'A microbenchmark may not explain whole-application latency. Use CPU and memory profiles for real workloads, then improve the actual bottleneck. Allocation counts are useful evidence, not a reason to abandon clear ownership or correct behavior.',
          ],
        },
      ],
      example: go`package main

import (
	"strings"
	"testing"
)

func TestJoin(t *testing.T) {

	if strings.Join([]string{"go", "lab"}, "-") != "go-lab" {

		t.Fatal("unexpected join")

	}

}
func BenchmarkJoin(b *testing.B) {

	parts := []string{"go", "lab"}

	for b.Loop() {

		_ = strings.Join(parts, "-")

	}

}
`,
      exercise: {
        prompt: 'Fix Join before measuring it locally.',
        hint: 'Preserve the separator contract.',
        solution: go`package main

import (
	"strings"
	"testing"
)

func Join(parts []string) string {
	return strings.Join(parts, "-")

}
func TestJoin(t *testing.T) {

	if got := Join([]string{"go", "lab"}); got != "go-lab" {

		t.Fatalf("got %q", got)

	}

}
func BenchmarkJoin(b *testing.B) {

	parts := []string{"go", "lab"}

	for b.Loop() {

		_ = Join(parts)

	}

}
`,
        starter: go`package main

import (
	"strings"
	"testing"
)

func Join(parts []string) string {
	return strings.Join(parts, "")

}
func TestJoin(t *testing.T) {

	if got := Join([]string{"go", "lab"}); got != "go-lab" {

		t.Fatalf("got %q", got)

	}

}
func BenchmarkJoin(b *testing.B) {

	parts := []string{"go", "lab"}

	for b.Loop() {

		_ = Join(parts)

	}

}
`,
      },
      quiz: {
        question: 'What should precede performance optimization?',
        options: [
          'Deleting error checks',
          'A correctness contract and representative measurement',
          'Assuming fewer lines run faster',
        ],
        answer: 1,
        explanation: 'Measure correct code under meaningful conditions before optimizing.',
      },
      references: [
        {
          label: 'Benchmarks',
          url: 'https://pkg.go.dev/testing#hdr-Benchmarks',
        },
        {
          label: 'Diagnostics',
          url: 'https://go.dev/doc/diagnostics',
        },
      ],
      tags: ['benchmarks', 'b.Loop', 'profiling', 'allocations'],
      mode: 'test',
    },
  ],
};
