import type { CourseModule } from '../course.model';
const go = String.raw;

export const start: CourseModule = {
  id: 'start',
  title: 'Start with Go',
  level: 'Beginner',
  description:
    'Install the toolchain, run your first program, and understand modules and compiler feedback.',
  lessons: [
    {
      id: 'toolchain',
      title: 'Go 1.27.4 and the toolchain',
      summary: 'Understand what the go command builds and where your code runs.',
      minutes: 18,
      objectives: [
        'Check the selected Go version',
        'Distinguish source, compilation, and execution',
      ],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'Install Go 1.27.4 from go.dev, then run go version in a terminal. The go command coordinates compilation, testing, formatting, and module management. go env shows its configuration. A .go file contains source; go build produces an executable, while go run builds and starts a temporary executable.',
            'This course uses Go 1.27.4 in go.mod and the Docker runner image. The go directive sets a minimum required toolchain version; it is not an exact upper bound. A newer installed toolchain may satisfy it. The image tag selects the compiler used by this playground.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Terminal commands do not belong in the editor. The browser sends a single source file to the local API, which executes it inside a disposable Linux container. The reported runtime version describes that container, which may differ from your host installation.',
            'The playground supports the standard library without downloading dependencies. Keep examples small and deterministic. Compiler success establishes language-level validity, not that your business rules are correct.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"runtime"
)

func main() {
	fmt.Println(runtime.Version())
	fmt.Println("Ready to learn Go")

}
`,
      exercise: {
        prompt: 'Print the course version using the constant, followed by a newline.',
        hint: 'Pass version to fmt.Println.',
        solution: go`package main

import "fmt"

func main() {
	const version = "Go 1.27.4"
	fmt.Println(version)

}
`,
        starter: go`package main

import "fmt"

func main() {
	const version = "Go 1.27.4"
	fmt.Println("TODO")

}
`,
        expectedOutput: 'Go 1.27.4',
      },
      quiz: {
        question: 'What does go build produce for package main?',
        options: ['An executable', 'Only formatted source', 'A JavaScript bundle'],
        answer: 0,
        explanation:
          'Go compiles a main package into an executable for the selected target platform.',
      },
      references: [
        {
          label: 'Install Go',
          url: 'https://go.dev/doc/install',
        },
        {
          label: 'Go toolchains',
          url: 'https://go.dev/doc/toolchain',
        },
      ],
      tags: ['installation', 'version', 'go build'],
    },
    {
      id: 'hello-go',
      title: 'Your first program',
      summary: 'Read packages, imports, main, and formatted output.',
      minutes: 18,
      objectives: ['Identify a program entry point', 'Format values with fmt'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'Every source file begins with a package declaration. A standalone command uses package main and a func main() entry point. Imports name packages used by that file; fmt provides formatted input and output. Exported names start with an uppercase letter, as in fmt.Println.',
            'Go normally inserts semicolons at line endings, so most programs omit them. Braces delimit blocks; place the opening brace on the same line as the function declaration. gofmt supplies consistent indentation and spacing.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Println separates arguments with spaces and appends a newline. Printf follows a format string: %s for text, %d for an integer, %v for a general value, and %T for its type. Printf does not add a newline automatically.',
            'Unused imports and local variables are compilation errors. Read the first diagnostic, correct the cause, and run again. A runtime panic occurs after compilation and is a different failure phase.',
          ],
        },
      ],
      example: go`package main

import "fmt"

func main() {

	name := "Go"

	fmt.Printf("Hello, %s!\n", name)

	fmt.Println("Progress:", 1)

}
`,
      expectedOutput: 'Hello, Go!\nProgress: 1',
      exercise: {
        prompt: 'Print exactly “Ada scored 42 points.” using name and score.',
        hint: 'Use %s and %d, then a newline.',
        solution: go`package main

import "fmt"

func main() {
	name, score := "Ada", 42
	fmt.Printf("%s scored %d points.\n", name, score)

}
`,
        starter: go`package main

import "fmt"

func main() {
	name, score := "Ada", 42
	fmt.Printf("TODO: %s %d\n", name, score)

}
`,
        expectedOutput: 'Ada scored 42 points.',
      },
      quiz: {
        question: 'Which name is exported from a package?',
        options: ['printlnLocal', 'main', 'Println'],
        answer: 2,
        explanation: 'An identifier whose first character is an uppercase letter is exported.',
      },
      references: [
        {
          label: 'Getting started',
          url: 'https://go.dev/doc/tutorial/getting-started',
        },
        {
          label: 'fmt',
          url: 'https://pkg.go.dev/fmt',
        },
      ],
      tags: ['main', 'fmt', 'syntax'],
    },
    {
      id: 'modules',
      title: 'Packages and modules',
      summary: 'Separate a package namespace from a versioned module.',
      minutes: 18,
      objectives: [
        'Create a module with go mod init',
        'Understand import paths and dependency versions',
      ],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A package is a group of Go files compiled together, usually in one directory. A module groups packages under a module path and a go.mod file. From a new directory, run go mod init example.com/hello, create main.go, then go run . and go test ./.... The ./... pattern includes packages recursively.',
            'The module path prefixes import paths for your own packages. go get example.com/library@version changes dependencies, and go mod tidy reconciles the manifest with imports. go.sum records checksums used to verify downloaded modules; it is not a complete dependency lockfile.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Commit go.mod and go.sum when dependencies create them. Do not change a module path merely to resolve a missing import: first verify the intended directory structure and package name. The standard library needs no go get.',
            'Multi-file packages and external dependencies belong in a local project; this editor is a one-file environment. Here we can still demonstrate importing two standard-library packages and using their exported APIs.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"strings"
)

func main() {
	fmt.Println(strings.ToUpper("go modules"))

}
`,
      expectedOutput: 'GO MODULES',
      exercise: {
        prompt: 'Trim surrounding whitespace from the module label before printing it.',
        hint: 'strings.TrimSpace accepts and returns a string.',
        solution: go`package main

import (
	"fmt"
	"strings"
)

func main() {
	label := "  go-lab  "
	fmt.Println(strings.TrimSpace(label))

}
`,
        starter: go`package main

import (
	"fmt"
	"strings"
)

func main() {
	label := "  go-lab  "
	fmt.Println(strings.TrimSuffix(label, "!"))

}
`,
        expectedOutput: 'go-lab',
      },
      quiz: {
        question: 'What does go.mod describe?',
        options: ['One function body', 'A module and its requirements', 'A container filesystem'],
        answer: 1,
        explanation:
          'A module can contain multiple packages; go.mod declares its path and requirements.',
      },
      references: [
        {
          label: 'Create a module',
          url: 'https://go.dev/doc/tutorial/create-module',
        },
        {
          label: 'Module reference',
          url: 'https://go.dev/ref/mod',
        },
      ],
      tags: ['modules', 'packages', 'go.mod'],
    },
    {
      id: 'project-layout',
      title: 'Build a multi-package project',
      summary: 'Turn package and module concepts into a maintainable project layout.',
      minutes: 20,
      objectives: [
        'Organize commands and reusable packages',
        'Run and test packages across a module',
      ],
      sections: [
        {
          title: 'Choose package boundaries',
          body: [
            'A practical module can put executable commands under cmd/ and reusable implementation under ordinary package directories. Keep one package per directory, name it for its purpose, and export only the identifiers callers need. An internal/ directory restricts imports to code within the permitted parent tree; it is not a general visibility mechanism.',
            'For example, go.mod can declare module example.com/ledger, cmd/report can import example.com/ledger/internal/ledger, and the ledger package can expose a Ledger type with Add and Total methods. Keep dependencies flowing toward the domain package rather than creating import cycles.',
          ],
          code: 'ledger/\\n  go.mod\\n  cmd/report/main.go\\n  internal/ledger/ledger.go\\n  internal/ledger/ledger_test.go',
        },
        {
          title: 'Run the whole module',
          body: [
            'From the module root, go test ./... discovers tests in every package, while go build ./... compiles them all. Run a specific command with go run ./cmd/report. Import paths come from the module path plus directory; package names come from the source files and need not repeat the full path.',
            'Hands-on locally: create the layout above, implement the Ledger package, add a package-level test, and run those commands. This playground accepts one source file, so it cannot compile a multi-package submission; its example and exercise check the small behavior before you split it into files.',
          ],
        },
      ],
      example: go`package main

import "fmt"

type Ledger struct {
	total int
}

func (l *Ledger) Add(amount int) {
	l.total += amount
}

func (l Ledger) Total() int {
	return l.total
}

func main() {
	var ledger Ledger
	ledger.Add(2)
	ledger.Add(3)
	fmt.Println(ledger.Total())
}
`,
      expectedOutput: '5',
      exercise: {
        prompt:
          'Complete Total so it returns the accumulated value. Then try moving Ledger into internal/ledger and using it from cmd/report in a local module.',
        hint: 'Return the field that Add updates.',
        starter: go`package main

import "fmt"

type Ledger struct {
	total int
}

func (l *Ledger) Add(amount int) {
	l.total += amount
}

func (l Ledger) Total() int {
	return 0
}

func main() {
	var ledger Ledger
	ledger.Add(2)
	ledger.Add(3)
	fmt.Println(ledger.Total())
}
`,
        solution: go`package main

import "fmt"

type Ledger struct {
	total int
}

func (l *Ledger) Add(amount int) {
	l.total += amount
}

func (l Ledger) Total() int {
	return l.total
}

func main() {
	var ledger Ledger
	ledger.Add(2)
	ledger.Add(3)
	fmt.Println(ledger.Total())
}
`,
        expectedOutput: '5',
      },
      quiz: {
        question: 'What does go test ./... do from a module root?',
        options: [
          'Tests only the current directory',
          'Tests packages recursively',
          'Downloads every possible dependency',
        ],
        answer: 1,
        explanation:
          'The ./... package pattern includes packages beneath the current module directory.',
      },
      references: [
        {
          label: 'Module layout',
          url: 'https://go.dev/doc/modules/layout',
        },
        {
          label: 'Internal packages',
          url: 'https://go.dev/doc/go1.4#internalpackages',
        },
      ],
      tags: ['modules', 'packages', 'project layout', 'internal'],
    },
    {
      id: 'workflow',
      title: 'Format, build, test, inspect',
      summary: 'Use a short feedback loop and distinguish diagnostics from output.',
      minutes: 18,
      objectives: ['Choose the appropriate Go command', 'Explain why building is not enough'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A useful local loop is gofmt -w ., go build ./..., go test ./..., and go vet ./.... Formatting is mechanical. Compilation checks syntax and types. Tests exercise selected behavior. Vet reports suspicious constructs such as a formatting argument that disagrees with its verb. None of these alone proves correctness.',
            'go doc fmt.Printf displays API documentation in a terminal. Read the signature, behavior on invalid input, and examples before relying on a function. Use the specification for exact language rules and package documentation for library contracts.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Do not “fix” a compiler error by discarding an error return without understanding it. Start with the first relevant diagnostic and reduce a failing example until the cause is visible. Output on stderr can come from the compiler, the test tool, or your own program.',
            'Effective Go remains useful for idioms, but predates modules and generics. Pair it with the current documentation and standard-library reference. The playground Format button uses gofmt; it does not run tests or repair a broken algorithm.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"strconv"
)

func main() {

	n, err := strconv.Atoi("42")

	if err != nil {

		fmt.Println("invalid number")

		return

	}

	fmt.Println(n + 1)

}
`,
      expectedOutput: '43',
      exercise: {
        prompt: 'Convert “21” and print twice its value. Keep error handling.',
        hint: 'Change the arithmetic, not the parsing or error path.',
        solution: go`package main

import (
	"fmt"
	"strconv"
)

func main() {

	n, err := strconv.Atoi("21")

	if err != nil {

		panic(err)

	}

	fmt.Println(n * 2)

}
`,
        starter: go`package main

import (
	"fmt"
	"strconv"
)

func main() {

	n, err := strconv.Atoi("21")

	if err != nil {

		panic(err)

	}

	fmt.Println(n + 2)

}
`,
        expectedOutput: '42',
      },
      quiz: {
        question: 'Does gofmt prove a program is correct?',
        options: [
          'Yes, it executes every branch',
          'Yes, it checks all inputs',
          'No, it formats source',
        ],
        answer: 2,
        explanation: 'Formatting, static checks, and behavioral tests address different concerns.',
      },
      references: [
        {
          label: 'Go documentation',
          url: 'https://go.dev/doc/',
        },
        {
          label: 'Effective Go',
          url: 'https://go.dev/doc/effective_go',
        },
        {
          label: 'go command',
          url: 'https://pkg.go.dev/cmd/go',
        },
      ],
      tags: ['gofmt', 'go vet', 'diagnostics'],
    },
  ],
};
