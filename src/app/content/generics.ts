import type { CourseModule } from '../course.model';
const go = String.raw;

export const generics: CourseModule = {
  id: 'generics',
  title: 'Generics and iteration',
  level: 'Intermediate',
  description: 'Type parameters, constraints, standard collection helpers, and iterator functions.',
  lessons: [
    {
      id: 'type-parameters',
      title: 'Type parameters',
      summary: 'Reuse algorithms while preserving type relationships.',
      minutes: 18,
      objectives: ['Write a generic function', 'Use type inference at call sites'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A type parameter names a type supplied to a generic declaration. Its constraint states the permitted types and operations. A function such as First[T any] can accept []T and return T without converting values through any. Callers often omit type arguments when the compiler can infer them.',
            'Use generics when an algorithm is genuinely the same across types. A generic function cannot assume operations that its constraint does not guarantee. any permits arbitrary types but does not guarantee ordering or arithmetic.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Generics do not remove the need to define empty-input behavior. Return an additional bool or error when the zero value alone would be ambiguous.',
            'Avoid adding type parameters where a concrete type or small interface already communicates the contract well. Generic APIs are useful when they preserve relationships, not simply because they reduce a few lines of duplication.',
          ],
        },
      ],
      example: go`package main

import "fmt"

func First[T any](values []T) (T, bool) {

	if len(values) > 0 {

		return values[0], true

	}

	var zero T

	return zero, false

}
func main() {
	fmt.Println(First([]string{"Go", "lab"}))
	fmt.Println(First([]int{}))

}
`,
      expectedOutput: 'Go true\n0 false',
      exercise: {
        prompt: 'Return the last element and false for empty input.',
        hint: 'The final valid index is len(values)-1.',
        solution: go`package main

import "fmt"

func Last[T any](values []T) (T, bool) {

	if len(values) > 0 {

		return values[len(values)-1], true

	}

	var zero T

	return zero, false

}
func main() {
	fmt.Println(Last([]int{2, 4, 8}))
	fmt.Println(Last([]string{}))

}
`,
        starter: go`package main

import "fmt"

func Last[T any](values []T) (T, bool) {

	if len(values) > 0 {

		return values[0], true

	}

	var zero T

	return zero, false

}
func main() {
	fmt.Println(Last([]int{2, 4, 8}))
	fmt.Println(Last([]string{}))

}
`,
        expectedOutput: '8 true\n false',
      },
      quiz: {
        question: 'Does any guarantee support for +?',
        options: ['No', 'Yes for all values', 'Only in methods'],
        answer: 0,
        explanation:
          'A generic operation must be supported by every type allowed by its constraint.',
      },
      references: [
        {
          label: 'Generics tutorial',
          url: 'https://go.dev/doc/tutorial/generics',
        },
      ],
      tags: ['generics', 'type parameters', 'any'],
    },
    {
      id: 'constraints',
      title: 'Constraints and underlying types',
      summary: 'Describe exactly the operations your algorithm needs.',
      minutes: 18,
      objectives: ['Use comparable and type sets', 'Explain the ~ approximation element'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A constraint is an interface describing permitted types and operations. comparable allows equality and map-key use. Type unions such as int | int64 list alternatives; ~int includes named types whose underlying type is int. cmp.Ordered provides standard ordered numeric and string types.',
            'Some interfaces include type elements and are usable only as constraints. They are not ordinary runtime interface values. Keep the constraint close to the algorithm it supports.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'comparable is not an ordering relation. The < operator needs an ordered constraint. Floating-point NaN also requires care when defining sorting or equality semantics.',
            'Named domain types can preserve meaning while reusing generic algorithms. Omitting ~ when it is intended can unnecessarily reject such types. Do not broaden a constraint beyond the operations that are semantically appropriate.',
          ],
        },
      ],
      example: go`package main

import "fmt"

type Count int

func Double[T ~int](n T) T {
	return n + n

}
func main() {
	fmt.Println(Double(Count(4)))

}
`,
      expectedOutput: '8',
      exercise: {
        prompt: 'Allow a named integer type to use Triple.',
        hint: 'The constraint needs ~int.',
        solution: go`package main

import "fmt"

type Count int

func Triple[T ~int](n T) T {
	return n * 3

}
func main() {
	fmt.Println(Triple(Count(4)))

}
`,
        starter: go`package main

import "fmt"

type Count int

func Triple[T int](n T) T {
	return n * 3

}
func main() {
	fmt.Println(Triple(Count(4)))

}
`,
        expectedOutput: '12',
      },
      quiz: {
        question: 'What does ~int include?',
        options: ['Only pointers to int', 'Every numeric type', 'Types with underlying type int'],
        answer: 2,
        explanation: 'The approximation element includes named types whose underlying type is int.',
      },
      references: [
        {
          label: 'Type sets',
          url: 'https://go.dev/ref/spec#General_interfaces',
        },
        {
          label: 'cmp',
          url: 'https://pkg.go.dev/cmp',
        },
      ],
      tags: ['constraints', 'comparable', 'underlying types'],
    },
    {
      id: 'collection-helpers',
      title: 'slices, maps, and cmp',
      summary: 'Use standard algorithms with clear mutation behavior.',
      minutes: 18,
      objectives: [
        'Clone before in-place sorting when needed',
        'Use standard generic collection APIs',
      ],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'The slices and maps packages provide common generic operations. slices.Sort changes its argument’s backing array. slices.Clone creates a shallow copy. slices.Equal compares corresponding elements. maps.Clone copies entries while retaining referenced objects in keys or values.',
            'Use slices.SortFunc with a consistent comparison for structured values. cmp.Compare supplies a standard three-way comparison for ordered values. The comparison must describe a coherent order for all elements you pass.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'A helper does not erase aliasing. Sorting a slice changes what other slices over the same elements observe. If the input must remain intact, clone first.',
            'Read each function’s contract for nil handling and mutation. Nested maps or slices still require a separate copy policy when independent nested storage is required.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"slices"
)

func main() {

	original := []int{3, 1, 2}

	sorted := slices.Clone(original)

	slices.Sort(sorted)

	fmt.Println(original)

	fmt.Println(sorted)

}
`,
      expectedOutput: '[3 1 2]\n[1 2 3]',
      exercise: {
        prompt: 'Sort a copy, preserving the input order.',
        hint: 'Clone before calling slices.Sort.',
        solution: go`package main

import (
	"fmt"
	"slices"
)

func main() {

	input := []int{9, 2, 4}

	result := slices.Clone(input)

	slices.Sort(result)

	fmt.Println(input)

	fmt.Println(result)

}
`,
        starter: go`package main

import (
	"fmt"
	"slices"
)

func main() {

	input := []int{9, 2, 4}

	result := input

	slices.Sort(result)

	fmt.Println(input)

	fmt.Println(result)

}
`,
        expectedOutput: '[9 2 4]\n[2 4 9]',
      },
      quiz: {
        question: 'Does slices.Sort allocate an independent copy?',
        options: ['No', 'Always', 'Only for integers'],
        answer: 0,
        explanation:
          'Sort operates on the supplied slice; clone explicitly to preserve the original storage.',
      },
      references: [
        {
          label: 'slices',
          url: 'https://pkg.go.dev/slices',
        },
        {
          label: 'maps',
          url: 'https://pkg.go.dev/maps',
        },
      ],
      tags: ['slices.Sort', 'maps.Clone', 'cmp'],
    },
    {
      id: 'iterators',
      title: 'Range over iterator functions',
      summary: 'Write lazy traversal with early termination.',
      minutes: 18,
      objectives: ['Implement iter.Seq', 'Honor yield returning false'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'Go can range over a function with a supported yield signature. iter.Seq[V] describes a sequence that calls yield(V) bool, while iter.Seq2[K,V] yields pairs. The consumer controls continuation through the Boolean result. This supports traversal without constructing an intermediate slice.',
            'A producer must stop calling yield as soon as it returns false. A break in the range loop communicates that stop request. Standard packages expose iterators, including maps.Keys and slices.Values.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'An iterator is not automatically a goroutine or a channel. The basic sequence function executes synchronously through yield. Avoid introducing concurrency unless the work benefits from it.',
            'If iteration owns a resource, keep cleanup tied to the function’s lifetime. Document whether a sequence can be restarted or is single-use. Do not retain yield to call it after the sequence function returns.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"iter"
)

func Count(n int) iter.Seq[int] {

	return func(yield func(int) bool) {

		for i := 0; i < n; i++ {

			if !yield(i) {

				return

			}

		}

	}

}
func main() {

	for n := range Count(5) {

		fmt.Println(n)

		if n == 1 {

			break

		}

	}

}
`,
      expectedOutput: '0\n1',
      exercise: {
        prompt: 'Yield the squares of 0, 1, and 2.',
        hint: 'Pass i*i to yield.',
        solution: go`package main

import (
	"fmt"
	"iter"
)

func Squares(n int) iter.Seq[int] {

	return func(yield func(int) bool) {

		for i := 0; i < n; i++ {

			if !yield(i * i) {

				return

			}

		}

	}

}
func main() {

	for n := range Squares(3) {

		fmt.Println(n)

	}

}
`,
        starter: go`package main

import (
	"fmt"
	"iter"
)

func Squares(n int) iter.Seq[int] {

	return func(yield func(int) bool) {

		for i := 0; i < n; i++ {

			if !yield(i) {

				return

			}

		}

	}

}
func main() {

	for n := range Squares(3) {

		fmt.Println(n)

	}

}
`,
        expectedOutput: '0\n1\n4',
      },
      quiz: {
        question: 'What must a producer do when yield returns false?',
        options: ['Stop yielding and return', 'Retry indefinitely', 'Start a goroutine'],
        answer: 0,
        explanation:
          'False means the consumer has stopped; another call violates the iterator contract.',
      },
      references: [
        {
          label: 'iter',
          url: 'https://pkg.go.dev/iter',
        },
        {
          label: 'Range clauses',
          url: 'https://go.dev/ref/spec#For_range',
        },
      ],
      tags: ['iter', 'range functions', 'yield'],
    },
  ],
};
