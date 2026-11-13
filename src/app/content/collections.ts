import type { CourseModule } from '../course.model';
const go = String.raw;

export const collections: CourseModule = {
  id: 'collections',
  title: 'Collections and text',
  level: 'Beginner',
  description: 'Arrays, slice sharing, maps, and Unicode-aware text handling.',
  lessons: [
    {
      id: 'arrays',
      title: 'Arrays and value semantics',
      summary: 'Understand fixed-size values before using slices.',
      minutes: 18,
      objectives: ['Explain array copying', 'Distinguish array length from slice capacity'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'An array has a fixed length that is part of its type: [3]int and [4]int are different types. Assignment and function arguments copy array values. A slice instead describes a portion of a backing array and can share that storage.',
            'Array literals can specify the length or use [...] to infer it from the elements. Indexing starts at zero. len reports the number of elements, and an out-of-range index panics.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Copying an array of pointers copies the pointers, not their targets. Value semantics operate on the immediate elements; they do not promise a recursive deep copy.',
            'Slices are usually more convenient for variable-size data. Arrays remain useful for fixed-size values such as digests or coordinates, particularly when their type-level length matters.',
          ],
        },
      ],
      example: go`package main

import "fmt"

func main() {
	a := [3]int{1, 2, 3}
	b := a
	b[0] = 9
	fmt.Println(a)
	fmt.Println(b)

}
`,
      expectedOutput: '[1 2 3]\n[9 2 3]',
      exercise: {
        prompt: 'Modify the copied array without changing original.',
        hint: 'Use an array value rather than a slice of original.',
        solution: go`package main

import "fmt"

func main() {

	original := [2]int{4, 5}

	copied := original

	copied[0] = 8

	fmt.Println(original)

	fmt.Println(copied)

}
`,
        starter: go`package main

import "fmt"

func main() {

	original := [2]int{4, 5}

	copied := original[:]

	copied[0] = 8

	fmt.Println(original)

	fmt.Println(copied)

}
`,
        expectedOutput: '[4 5]\n[8 5]',
      },
      quiz: {
        question: 'Is array length part of its type?',
        options: ['Yes', 'No', 'Only for strings'],
        answer: 0,
        explanation: 'Arrays of different lengths have different types.',
      },
      references: [
        {
          label: 'Array types',
          url: 'https://go.dev/ref/spec#Array_types',
        },
      ],
      tags: ['arrays', 'values', 'copy'],
    },
    {
      id: 'slices',
      title: 'Slices, append, and shared storage',
      summary: 'Reason about length, capacity, and aliasing.',
      minutes: 18,
      objectives: ['Predict aliasing between slices', 'Use append and clone deliberately'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A slice describes a backing array, a length, and a capacity. Copying a slice copies that description. Two slices can therefore observe mutations to the same elements. len counts accessible elements; cap counts how far the slice can grow before new storage is required.',
            'append returns the resulting slice and may allocate a new backing array. Always use its return value. A full slice expression a[low:high:max] limits capacity and can force a future append to allocate, but does not copy current elements.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Never rely on an exact capacity growth factor; it is an implementation choice. Use slices.Clone when independent element storage is needed. Cloning is shallow: nested slices, maps, or pointers still share their referenced data.',
            'A nil slice has length zero and can be appended to. A non-nil empty slice also has length zero, but APIs such as JSON encoding can distinguish them.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"slices"
)

func main() {

	a := []int{1, 2, 3}

	b := a[:2]

	b[0] = 9

	c := slices.Clone(a)

	c[0] = 7

	fmt.Println(a)

	fmt.Println(c)

}
`,
      expectedOutput: '[9 2 3]\n[7 2 3]',
      exercise: {
        prompt: 'Append 3 and keep the result.',
        hint: 'Assign append’s returned slice.',
        solution: go`package main

import "fmt"

func main() {
	values := []int{1, 2}
	values = append(values, 3)
	fmt.Println(values)

}
`,
        starter: go`package main

import "fmt"

func main() {

	values := []int{1, 2}

	_ = append(values, 3)
	/* TODO: retain result*/
	fmt.Println(values)

}
`,
        expectedOutput: '[1 2 3]',
      },
      quiz: {
        question: 'What does copying a slice copy?',
        options: [
          'Its descriptor, sharing backing storage',
          'All nested elements deeply',
          'Only its first element',
        ],
        answer: 0,
        explanation:
          'A copied slice still refers to the same backing array until an operation changes that relationship.',
      },
      references: [
        {
          label: 'Slices',
          url: 'https://go.dev/blog/slices-intro',
        },
        {
          label: 'slices',
          url: 'https://pkg.go.dev/slices',
        },
      ],
      tags: ['slices', 'append', 'capacity', 'aliasing'],
    },
    {
      id: 'maps',
      title: 'Maps, lookups, and sets',
      summary: 'Model associations while keeping output deterministic.',
      minutes: 18,
      objectives: ['Distinguish absent keys from zero values', 'Sort keys for stable presentation'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A map associates comparable keys with values. The single-result lookup returns the value type’s zero value for an absent key. The two-result lookup, value, ok := m[key], distinguishes absence from a stored zero. Use make or a map literal before writing to a map.',
            'A map[T]struct{} is a common set representation. delete removes a key and is safe when the key is absent. Assigning a map variable shares the same underlying map; use maps.Clone for an independent shallow copy.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Reading a nil map is valid; writing to it panics. Ordinary maps do not support concurrent reads and writes without synchronization. Choose a mutex or a goroutine owner when sharing one.',
            'Iteration order is unspecified. Extract and sort keys for reports or tests. Do not treat a stable-looking run as evidence of a language guarantee.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"maps"
	"slices"
)

func main() {

	counts := map[string]int{"go": 2, "code": 1}

	for _, k := range slices.Sorted(maps.Keys(counts)) {

		fmt.Println(k, counts[k])

	}

}
`,
      expectedOutput: 'code 1\ngo 2',
      exercise: {
        prompt: 'Report that the stored zero exists using a two-result lookup.',
        hint: 'The ok result tests presence, not value.',
        solution: go`package main

import "fmt"

func main() {
	scores := map[string]int{"Ada": 0}
	value, ok := scores["Ada"]
	fmt.Println(value, ok)

}
`,
        starter: go`package main

import "fmt"

func main() {
	scores := map[string]int{"Ada": 0}
	value, ok := scores["Grace"]
	fmt.Println(value, ok)

}
`,
        expectedOutput: '0 true',
      },
      quiz: {
        question: 'What happens when writing to a nil map?',
        options: ['It allocates automatically', 'It panics', 'It silently ignores the write'],
        answer: 1,
        explanation: 'Initialize maps before assignment; nil map reads are allowed.',
      },
      references: [
        {
          label: 'Maps',
          url: 'https://go.dev/blog/maps',
        },
        {
          label: 'maps',
          url: 'https://pkg.go.dev/maps',
        },
      ],
      tags: ['maps', 'sets', 'lookup', 'ordering'],
    },
    {
      id: 'strings',
      title: 'Strings, bytes, and Unicode',
      summary: 'Choose the unit your text algorithm actually needs.',
      minutes: 18,
      objectives: ['Distinguish bytes and runes', 'Handle UTF-8 without assuming ASCII'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A string is an immutable sequence of bytes. Go source strings commonly contain UTF-8, but a string can contain arbitrary bytes. len counts bytes and indexing returns a byte. range decodes UTF-8 into rune values and returns byte offsets.',
            'A rune is an alias for int32 and commonly holds a Unicode code point. A code point is not necessarily a user-perceived character: combining marks and emoji sequences can contain several. Decide whether your operation works on bytes, code points, or grapheme clusters.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Converting to []rune lets you index code points but allocates storage and does not solve grapheme segmentation. strings provides common operations without manual indexing. Invalid UTF-8 is handled according to each API’s documented rules.',
            'Use strings.Builder for repeated construction, and avoid copying a non-zero Builder. Case conversion and comparison have Unicode and locale subtleties; do not invent an ASCII-only rule for international text.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"unicode/utf8"
)

func main() {

	text := "Go ☕"

	fmt.Println(len(text))

	fmt.Println(utf8.RuneCountInString(text))

	for i, r := range "é!" {

		fmt.Printf("%d %c\n", i, r)

	}

}
`,
      expectedOutput: '6\n4\n0 é\n2 !',
      exercise: {
        prompt: 'Count code points in “café”, not bytes.',
        hint: 'Use utf8.RuneCountInString.',
        solution: go`package main

import (
	"fmt"
	"unicode/utf8"
)

func main() {
	text := "café"
	_ = utf8.ValidString(text)
	fmt.Println(utf8.RuneCountInString(text))

}
`,
        starter: go`package main

import (
	"fmt"
	"unicode/utf8"
)

func main() {
	text := "café"
	_ = utf8.ValidString(text)
	fmt.Println(len(text))

}
`,
        expectedOutput: '4',
      },
      quiz: {
        question: 'What does len(string) count?',
        options: ['Grapheme clusters', 'Bytes', 'Always Unicode code points'],
        answer: 1,
        explanation: 'Strings are byte sequences; UTF-8 code points can occupy multiple bytes.',
      },
      references: [
        {
          label: 'Strings, bytes, runes',
          url: 'https://go.dev/blog/strings',
        },
        {
          label: 'unicode/utf8',
          url: 'https://pkg.go.dev/unicode/utf8',
        },
      ],
      tags: ['strings', 'Unicode', 'runes', 'UTF-8'],
    },
  ],
};
