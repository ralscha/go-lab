import type { CourseModule } from '../course.model';
const go = String.raw;

export const modeling: CourseModule = {
  id: 'modeling',
  title: 'Types, interfaces, and errors',
  level: 'Intermediate',
  description: 'Model data and behavior with clear value, mutation, and error contracts.',
  lessons: [
    {
      id: 'pointers',
      title: 'Pointers and mutation',
      summary: 'Make caller-visible changes explicit.',
      minutes: 18,
      objectives: ['Use & and *', 'Explain pointer parameter behavior'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A pointer stores the address of a value. &value obtains an address and *pointer accesses the value at that address. Go passes every argument by value, including pointers; copying a pointer still allows access to its target. There is no ordinary pointer arithmetic.',
            'The zero value of a pointer is nil. Dereferencing nil panics. Returning a pointer to a local variable is valid: the compiler and runtime arrange for the value to remain alive as needed.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Use a pointer when shared mutation or identity is part of the contract. It is not automatically faster than a value: allocation and escape behavior depend on use. Measure real workloads.',
            'Reassigning a pointer parameter changes the local copy, while writing through it changes its target. Garbage collection handles memory lifetime, not file closing or concurrency safety.',
          ],
        },
      ],
      example: go`package main

import "fmt"

func increment(n *int) {
	*n = *n + 1

}
func main() {
	n := 4
	increment(&n)
	fmt.Println(n)

}
`,
      expectedOutput: '5',
      exercise: {
        prompt: 'Reset the caller’s score to zero.',
        hint: 'Assign through the pointer.',
        solution: go`package main

import "fmt"

func reset(n *int) {
	*n = 0

}
func main() {
	n := 42
	reset(&n)
	fmt.Println(n)

}
`,
        starter: go`package main

import "fmt"

func reset(n *int) {
	n = new(int)
	/* TODO: update the target*/
}
func main() {
	n := 42
	reset(&n)
	fmt.Println(n)

}
`,
        expectedOutput: '0',
      },
      quiz: {
        question: 'How are pointer parameters passed?',
        options: ['By moving ownership', 'By implicit deep copy', 'By value'],
        answer: 2,
        explanation: 'The pointer is copied; both copies can refer to the same target.',
      },
      references: [
        {
          label: 'Pointer types',
          url: 'https://go.dev/ref/spec#Pointer_types',
        },
      ],
      tags: ['pointers', 'nil', 'mutation'],
    },
    {
      id: 'structs',
      title: 'Structs, methods, and embedding',
      summary: 'Attach behavior to useful domain types.',
      minutes: 18,
      objectives: ['Define struct values and methods', 'Choose pointer or value receivers'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A struct groups named fields into a value. Define methods on a named type to expose behavior. A value receiver receives a copy; a pointer receiver can mutate the original. Keep receiver choices consistent for a type when possible.',
            'Embedding promotes selected fields and methods of another type. It is composition, not class inheritance. The embedded value still exists as a field, and naming conflicts can require explicit selection.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'A value copy of a struct containing a slice or map still shares that referenced storage. Do not copy a sync.Mutex after use. Consider what invariants exported fields permit callers to bypass.',
            'Go can automatically take an address for some method calls on addressable values, but interface method sets still distinguish T and *T. Do not assume every value satisfies an interface implemented by its pointer.',
          ],
        },
      ],
      example: go`package main

import "fmt"

type Counter struct{ value int }

func (c *Counter) Add(n int) {
	c.value += n

}
func (c Counter) Value() int {
	return c.value

}
func main() {
	var c Counter
	c.Add(3)
	fmt.Println(c.Value())

}
`,
      expectedOutput: '3',
      exercise: {
        prompt: 'Let Resize change the original rectangle.',
        hint: 'Use a pointer receiver.',
        solution: go`package main

import "fmt"

type Rectangle struct{ Width, Height int }

func (r *Rectangle) Resize(w int) {
	r.Width = w

}
func main() {
	r := Rectangle{2, 3}
	r.Resize(4)
	fmt.Println(r.Width * r.Height)

}
`,
        starter: go`package main

import "fmt"

type Rectangle struct{ Width, Height int }

func (r Rectangle) Resize(w int) {
	r.Width = w

}
func main() {
	r := Rectangle{2, 3}
	r.Resize(4)
	fmt.Println(r.Width * r.Height)

}
`,
        expectedOutput: '12',
      },
      quiz: {
        question: 'What does embedding provide?',
        options: ['Class inheritance', 'Composition and promotion', 'Automatic deep cloning'],
        answer: 1,
        explanation:
          'Embedding can promote members but does not establish an inheritance hierarchy.',
      },
      references: [
        {
          label: 'Methods',
          url: 'https://go.dev/ref/spec#Method_declarations',
        },
        {
          label: 'Embedding',
          url: 'https://go.dev/doc/effective_go#embedding',
        },
      ],
      tags: ['structs', 'methods', 'embedding'],
    },
    {
      id: 'interfaces',
      title: 'Interfaces and typed nil',
      summary: 'Depend on small behavior contracts.',
      minutes: 18,
      objectives: ['Satisfy interfaces implicitly', 'Recognize an interface holding a nil pointer'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'An interface describes behavior through methods. A type satisfies it by providing those methods; no implements declaration is needed. Define small interfaces where behavior is consumed, such as io.Reader, rather than inventing a large abstraction for every concrete type.',
            'An interface value carries a dynamic type and a dynamic value. It is nil only when both are absent. An interface containing a typed nil pointer is therefore not nil. A method call may still panic if its receiver handling dereferences that pointer.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Use a type assertion with the comma-ok form when a dynamic type may not match. A type switch handles several possibilities. Prefer a method contract over repeatedly inspecting concrete types.',
            'An interface is not a universal substitute for generics. Interfaces describe runtime behavior; type parameters can express relationships among types and operations at compile time.',
          ],
        },
      ],
      example: go`package main

import "fmt"

type Speaker interface{ Speak() string }
type Person string

func (p Person) Speak() string {
	return "Hello, " + string(p)

}
func greet(s Speaker) {
	fmt.Println(s.Speak())

}
func main() {
	greet(Person("Ada"))
	var p *int
	var value any = p
	fmt.Println(p == nil, value == nil)

}
`,
      expectedOutput: 'Hello, Ada\ntrue false',
      exercise: {
        prompt: 'Make Label satisfy fmt.Stringer and print its label.',
        hint: 'The required method is String() string.',
        solution: go`package main

import "fmt"

type Label string

func (l Label) String() string {
	return "label: " + string(l)

}
func main() {
	var s fmt.Stringer = Label("Go")
	fmt.Println(s.String())

}
`,
        starter: go`package main

import "fmt"

type Label string

func (l Label) String() string {
	return string(l)
	/* TODO: include the prefix*/
}
func main() {
	var s fmt.Stringer = Label("Go")
	fmt.Println(s.String())

}
`,
        expectedOutput: 'label: Go',
      },
      quiz: {
        question: 'Is an interface containing a typed nil pointer nil?',
        options: ['Always', 'No', 'Only on Linux'],
        answer: 1,
        explanation: 'Its dynamic type is still present, so the interface itself is not nil.',
      },
      references: [
        {
          label: 'Interface types',
          url: 'https://go.dev/ref/spec#Interface_types',
        },
        {
          label: 'io.Reader',
          url: 'https://pkg.go.dev/io#Reader',
        },
      ],
      tags: ['interfaces', 'method sets', 'typed nil'],
    },
    {
      id: 'errors',
      title: 'Errors, wrapping, and inspection',
      summary: 'Return useful failure information without losing its cause.',
      minutes: 18,
      objectives: ['Wrap errors with context', 'Inspect chains using errors.Is and errors.As'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'error is an interface with an Error() string method. Return a value and an error for operations that can fail, and check the error before using a result whose contract depends on success. Error text should help the caller understand the failed operation.',
            'fmt.Errorf with %w adds context while preserving an underlying error. errors.Is checks a chain for a particular error; errors.As locates a matching error type. This allows callers to react without matching human-facing strings.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Do not both log and return an error at every layer; report it at the boundary that has enough context to act. Wrapping exposes a cause as part of the API contract, so be deliberate about which implementation errors callers may rely on.',
            'Return a nil error interface directly on success. A typed nil pointer converted to error can become a non-nil interface. Panics are not a replacement for ordinary validation errors.',
          ],
        },
      ],
      example: go`package main

import (
	"errors"
	"fmt"
)

var ErrEmpty = errors.New("empty name")

func validate(name string) error {

	if name == "" {

		return fmt.Errorf("profile: %w", ErrEmpty)

	}

	return nil

}
func main() {
	err := validate("")
	fmt.Println(err)
	fmt.Println(errors.Is(err, ErrEmpty))

}
`,
      expectedOutput: 'profile: empty name\ntrue',
      exercise: {
        prompt: 'Preserve ErrMissing while adding load context.',
        hint: 'Use %w rather than %v.',
        solution: go`package main

import (
	"errors"
	"fmt"
)

func main() {

	missing := errors.New("missing")

	err := fmt.Errorf("load: %w", missing)

	fmt.Println(errors.Is(err, missing))

}
`,
        starter: go`package main

import (
	"errors"
	"fmt"
)

func main() {

	missing := errors.New("missing")

	err := fmt.Errorf("load: %v", missing)

	fmt.Println(errors.Is(err, missing))

}
`,
        expectedOutput: 'true',
      },
      quiz: {
        question: 'Which verb preserves an error for errors.Is?',
        options: ['%w', '%s', '%d'],
        answer: 0,
        explanation: 'fmt.Errorf with %w wraps an error so its cause remains inspectable.',
      },
      references: [
        {
          label: 'Working with errors',
          url: 'https://go.dev/blog/go1.13-errors',
        },
        {
          label: 'errors',
          url: 'https://pkg.go.dev/errors',
        },
      ],
      tags: ['error', 'wrapping', 'errors.Is', 'errors.As'],
    },
    {
      id: 'custom-errors',
      title: 'Custom error types',
      summary: 'Expose structured failure details when callers need to respond to them.',
      minutes: 18,
      objectives: [
        'Define an error type with useful context',
        'Inspect wrapped typed errors with errors.As',
      ],
      sections: [
        {
          title: 'Choose an error contract',
          body: [
            'Use a sentinel error when callers only need to distinguish a stable condition with errors.Is. Define a custom error type when callers need structured details, such as a field name, rejected value, or retry delay. Its Error method should produce useful text, but callers should not parse that text.',
            'A typed error is part of the package API. Keep its fields and behavior intentional: exported details let callers inspect them, while private fields with accessors preserve more implementation freedom.',
          ],
        },
        {
          title: 'Inspect without losing context',
          body: [
            'Wrap the typed error with %w when adding operation context. errors.As walks the error chain and assigns a matching value to its target. The target must have the right pointer shape: for *LimitError, declare a *LimitError variable and pass its address.',
            'Do not use a custom type just to decorate a message, or expose low-level details that callers should not depend on. Prefer errors.Is for stable categories and errors.As for structured data.',
          ],
          code: 'var limitErr *LimitError\\nif errors.As(err, &limitErr) {\\n    fmt.Println(limitErr.Limit)\\n}',
        },
      ],
      example: go`package main

import (
	"errors"
	"fmt"
)

type LimitError struct {
	Limit int
}

func (e *LimitError) Error() string {
	return fmt.Sprintf("limit is %d", e.Limit)
}

func check(value int) error {
	if value > 10 {
		return fmt.Errorf("save value: %w", &LimitError{Limit: 10})
	}
	return nil
}

func main() {
	err := check(12)
	var limitErr *LimitError
	if errors.As(err, &limitErr) {
		fmt.Println(limitErr.Limit)
	}
}
`,
      expectedOutput: '10',
      exercise: {
        prompt:
          'Return a typed RangeError for values above the limit, then print its Limit using errors.As.',
        hint: 'Give RangeError an Error() string method and wrap or return its pointer.',
        starter: go`package main

import (
	"errors"
	"fmt"
)

type RangeError struct {
	Limit int
}

func (e *RangeError) Error() string {
	return "out of range"
}

func check(value int) error {
	if value > 5 {
		return errors.New("out of range")
	}
	return nil
}

func main() {
	err := check(8)
	var rangeErr *RangeError
	if errors.As(err, &rangeErr) {
		fmt.Println(rangeErr.Limit)
	} else {
		fmt.Println("untyped")
	}
}
`,
        solution: go`package main

import (
	"errors"
	"fmt"
)

type RangeError struct {
	Limit int
}

func (e *RangeError) Error() string {
	return fmt.Sprintf("value exceeds %d", e.Limit)
}

func check(value int) error {
	if value > 5 {
		return &RangeError{Limit: 5}
	}
	return nil
}

func main() {
	err := check(8)
	var rangeErr *RangeError
	if errors.As(err, &rangeErr) {
		fmt.Println(rangeErr.Limit)
	} else {
		fmt.Println("untyped")
	}
}
`,
        expectedOutput: '5',
      },
      quiz: {
        question: 'Which function retrieves a matching custom error type from a chain?',
        options: ['errors.As', 'errors.Is', 'fmt.Sprint'],
        answer: 0,
        explanation:
          'errors.As searches an error chain for a value assignable to the requested target type.',
      },
      references: [
        {
          label: 'Working with errors',
          url: 'https://go.dev/blog/go1.13-errors',
        },
        {
          label: 'errors.As',
          url: 'https://pkg.go.dev/errors#As',
        },
      ],
      tags: ['errors', 'custom types', 'errors.As', 'API design'],
    },
  ],
};
