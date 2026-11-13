import type { CourseModule } from '../course.model';
const go = String.raw;

export const basics: CourseModule = {
  id: 'basics',
  title: 'Language essentials',
  level: 'Beginner',
  description: 'Values, control flow, functions, closures, and deferred cleanup.',
  lessons: [
    {
      id: 'variables',
      title: 'Variables, constants, and zero values',
      summary: 'Choose a type and understand initialization.',
      minutes: 18,
      objectives: ['Use var, :=, and const', 'Convert numeric types explicitly'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'var declares a variable, optionally with a type or initializer. Inside a function, := declares at least one new variable in the current block and infers types from the values. Assignment with = changes an existing variable. Constants represent compile-time values and cannot be reassigned.',
            'An uninitialized variable has its type’s zero value: 0 for numbers, false for booleans, and an empty string for strings. Pointers, slices, maps, channels, and functions have nil zero values. Choose types to communicate meaning instead of converting everything to strings.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Go does not implicitly mix int and float64 in arithmetic. An explicit conversion documents the decision, but can truncate or overflow; it is not validation. Untyped numeric constants can adapt to a suitable type when representable.',
            'A short declaration in an inner block can shadow an outer variable. Inspect the scope when an assignment appears to disappear. Use gofmt and keep declarations close to their first use.',
          ],
        },
      ],
      example: go`package main

import "fmt"

func main() {

	var count int

	const limit = 3

	count += limit

	fmt.Println(count)

	fmt.Printf("%.1f\n", float64(count)/2)

}
`,
      expectedOutput: '3\n1.5',
      exercise: {
        prompt: 'Calculate a floating-point average of 7 and 2.',
        hint: 'Convert before dividing.',
        solution: go`package main

import "fmt"

func main() {
	total, count := 7, 2
	fmt.Printf("%.1f\n", float64(total)/float64(count))

}
`,
        starter: go`package main

import "fmt"

func main() {
	total, count := 7, 2
	fmt.Printf("%.1f\n", float64(total/count))

}
`,
        expectedOutput: '3.5',
      },
      quiz: {
        question: 'What is the zero value of bool?',
        options: ['false', 'true', 'nil'],
        answer: 0,
        explanation: 'A bool always has a Boolean value; its zero value is false.',
      },
      references: [
        {
          label: 'Declarations',
          url: 'https://go.dev/ref/spec#Declarations_and_scope',
        },
      ],
      tags: ['var', 'const', 'zero values', 'conversion'],
    },
    {
      id: 'control-flow',
      title: 'If, switch, for, and range',
      summary: 'Express branching and repetition without hidden truthiness.',
      minutes: 18,
      objectives: ['Write explicit Boolean conditions', 'Use range and switch correctly'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'An if condition must be Boolean. It can begin with a short statement whose variables remain in scope through the associated else branches. A switch selects one case and normally stops there; it does not implicitly fall through. A switch without an expression is a readable sequence of Boolean cases.',
            'Go has one loop keyword, for. It supports initialization/condition/update, a condition-only loop, and an unbounded loop. range visits elements of a collection; its result variables depend on the collection type. For a slice, they are the index and a copy of the element.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Changing a range value does not replace the corresponding slice element. Assign through the index if replacement is intended. Map traversal order is unspecified; sort keys when visible output must be stable.',
            'A break inside a switch stops that switch, not an enclosing loop. Use a labeled break only when it makes control flow clearer. Every open-ended loop should have an intentional cancellation or termination condition.',
          ],
        },
      ],
      example: go`package main

import "fmt"

func main() {

	for n := 1; n <= 3; n++ {

		switch {

		case n%2 == 0:

			fmt.Println("even")

		default:

			fmt.Println("odd")

		}

	}

}
`,
      expectedOutput: 'odd\neven\nodd',
      exercise: {
        prompt: 'Sum only the even values in the slice.',
        hint: 'Test n%2 == 0 inside the loop.',
        solution: go`package main

import "fmt"

func main() {

	total := 0

	for _, n := range []int{1, 2, 3, 4} {

		if n%2 == 0 {

			total += n

		}

	}

	fmt.Println(total)

}
`,
        starter: go`package main

import "fmt"

func main() {

	total := 0

	for _, n := range []int{1, 2, 3, 4} {

		if n%2 != 0 {

			total += n

		}

	}

	fmt.Println(total)

}
`,
        expectedOutput: '6',
      },
      quiz: {
        question: 'Does switch automatically fall through?',
        options: ['No', 'Always', 'Only for integer cases'],
        answer: 0,
        explanation: 'Go cases stop by default; fallthrough is explicit and rarely needed.',
      },
      references: [
        {
          label: 'Control structures',
          url: 'https://go.dev/doc/effective_go#control-structures',
        },
        {
          label: 'For statements',
          url: 'https://go.dev/ref/spec#For_statements',
        },
      ],
      tags: ['if', 'switch', 'for', 'range'],
    },
    {
      id: 'functions',
      title: 'Functions, multiple results, and closures',
      summary: 'Keep operations small and make their contracts explicit.',
      minutes: 18,
      objectives: ['Return multiple results', 'Capture state in a closure'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'Function signatures declare parameter and result types. Multiple results are useful when returning a value alongside an error or an existence flag. Parameters are passed by value. Copying a slice or pointer still allows access to the underlying storage; it does not deeply copy that storage.',
            'Functions are values: they can be assigned, passed, and returned. A closure refers to variables in its surrounding scope. Those variables remain available as long as needed. This is useful for callbacks and small stateful operations, but shared captured state still needs synchronization across goroutines.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'A variadic parameter such as values ...int accepts zero or more arguments. Pass an existing slice with values.... Inside the function, the parameter is a slice. Document whether a function mutates caller-visible data.',
            'Prefer explicit returns when named return variables would obscure the result. A closure is not automatically concurrent or memoized; it is an ordinary function with access to captured variables.',
          ],
        },
      ],
      example: go`package main

import "fmt"

func counter() func() int {
	n := 0
	return func() int {
		n++
		return n

	}

}
func main() {
	next := counter()
	fmt.Println(next(), next(), next())

}
`,
      expectedOutput: '1 2 3',
      exercise: {
        prompt: 'Implement the variadic sum so it returns 10.',
        hint: 'Accumulate every argument.',
        solution: go`package main

import "fmt"

func sum(values ...int) int {

	total := 0

	for _, value := range values {

		total += value

	}

	return total

}
func main() {
	fmt.Println(sum(2, 3, 5))

}
`,
        starter: go`package main

import "fmt"

func sum(values ...int) int {

	total := 0

	for _, value := range values {

		total = value
		/* TODO: accumulate*/

	}

	return total

}
func main() {
	fmt.Println(sum(2, 3, 5))

}
`,
        expectedOutput: '10',
      },
      quiz: {
        question: 'What does a closure capture?',
        options: [
          'Variables in its surrounding scope',
          'Only immutable constants',
          'A new operating-system thread',
        ],
        answer: 0,
        explanation:
          'A closure can continue to access variables from the scope where it was created.',
      },
      references: [
        {
          label: 'Function types',
          url: 'https://go.dev/ref/spec#Function_types',
        },
        {
          label: 'Function literals',
          url: 'https://go.dev/ref/spec#Function_literals',
        },
      ],
      tags: ['functions', 'closures', 'variadic'],
    },
    {
      id: 'defer',
      title: 'Defer, panic, and recover',
      summary: 'Make resource cleanup predictable and understand exceptional failure.',
      minutes: 18,
      objectives: ['Predict defer evaluation and order', 'Reserve panic for exceptional failures'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'defer schedules a call for when the surrounding function returns, including during panic unwinding. Its receiver and arguments are evaluated when the defer statement executes. Deferred calls execute in last-in, first-out order. Place cleanup immediately after successfully acquiring a resource.',
            'A panic stops normal control flow and unwinds the goroutine’s stack. recover can stop that unwinding when called directly from a deferred function in the same goroutine. Ordinary invalid input and expected failures usually belong in error returns.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Defers inside a loop accumulate until the function returns, not until each iteration ends. For many files, extract a per-file function or close explicitly. A deferred close may itself fail; for important writes, account for close errors.',
            'Avoid broad recovery that silently turns a broken invariant into success. Recovery at a boundary should report the failure and preserve useful diagnostics. os.Exit skips deferred functions.',
          ],
        },
      ],
      example: go`package main

import "fmt"

func main() {

	n := 1

	defer fmt.Println("saved", n)

	defer fmt.Println("last registered")

	n = 2

	fmt.Println("current", n)

}
`,
      expectedOutput: 'current 2\nlast registered\nsaved 1',
      exercise: {
        prompt: 'Schedule “closed” so it prints after “working”.',
        hint: 'Defer the cleanup call.',
        solution: go`package main

import "fmt"

func main() {
	defer fmt.Println("closed")
	fmt.Println("working")

}
`,
        starter: go`package main

import "fmt"

func main() {
	fmt.Println("closed")
	/* TODO: defer cleanup*/ fmt.Println("working")

}
`,
        expectedOutput: 'working\nclosed',
      },
      quiz: {
        question: 'When are deferred call arguments evaluated?',
        options: ['Only when the function returns', 'At compile time', 'When defer executes'],
        answer: 2,
        explanation: 'The call runs later, but its arguments are evaluated immediately.',
      },
      references: [
        {
          label: 'Defer statements',
          url: 'https://go.dev/ref/spec#Defer_statements',
        },
        {
          label: 'Defer, panic, recover',
          url: 'https://go.dev/blog/defer-panic-and-recover',
        },
      ],
      tags: ['defer', 'panic', 'recover'],
    },
  ],
};
