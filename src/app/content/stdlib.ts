import type { CourseModule } from '../course.model';
const go = String.raw;

export const stdlib: CourseModule = {
  id: 'stdlib',
  title: 'The standard library',
  level: 'Intermediate',
  description: 'Readers, files, JSON v2, and time without external dependencies.',
  lessons: [
    {
      id: 'readers-writers',
      title: 'Readers, writers, and buffered I/O',
      summary: 'Compose streaming operations around small interfaces.',
      minutes: 18,
      objectives: ['Use io.Reader and io.Writer', 'Check scanner and copy errors'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'io.Reader reads bytes into a supplied buffer and returns a byte count plus an error. A call can return both data and an error; process the bytes before handling the error. io.Writer reports how many bytes it accepted and whether writing failed.',
            'io.Copy connects a reader to a writer. bytes.Buffer and strings.Reader let you exercise I/O logic without a filesystem. bufio adds buffering and Scanner offers convenient tokenization such as line scanning.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'After a Scanner loop, check scanner.Err. The default token limit is bounded, so large lines require an explicit Buffer policy or a different reading strategy. io.ReadAll is convenient only when input size is suitably bounded.',
            'Do not assume every Read fills the buffer. Use io.ReadFull when the protocol requires a fixed number of bytes. Interfaces allow testing short reads and failures separately from the operating system.',
          ],
        },
      ],
      example: go`package main

import (
	"bytes"
	"fmt"
	"io"
	"strings"
)

func main() {

	var out bytes.Buffer

	n, err := io.Copy(&out, strings.NewReader("Go streams"))

	if err != nil {

		panic(err)

	}

	fmt.Println(n, out.String())

}
`,
      expectedOutput: '10 Go streams',
      exercise: {
        prompt: 'Count every line and preserve the Scanner error check.',
        hint: 'Increment the count instead of assigning one.',
        solution: go`package main

import (
	"bufio"
	"fmt"
	"strings"
)

func main() {

	scanner := bufio.NewScanner(strings.NewReader("one\ntwo\nthree"))

	count := 0

	for scanner.Scan() {

		count++

	}

	if err := scanner.Err(); err != nil {

		panic(err)

	}

	fmt.Println(count)

}
`,
        starter: go`package main

import (
	"bufio"
	"fmt"
	"strings"
)

func main() {

	scanner := bufio.NewScanner(strings.NewReader("one\ntwo\nthree"))

	count := 0

	for scanner.Scan() {

		count = 1

	}

	if err := scanner.Err(); err != nil {

		panic(err)

	}

	fmt.Println(count)

}
`,
        expectedOutput: '3',
      },
      quiz: {
        question: 'Can Read return n > 0 and a non-nil error?',
        options: ['Yes', 'Never', 'Only for files'],
        answer: 0,
        explanation:
          'The Reader contract permits data and an error together; process the data first.',
      },
      references: [
        {
          label: 'io',
          url: 'https://pkg.go.dev/io',
        },
        {
          label: 'bufio',
          url: 'https://pkg.go.dev/bufio',
        },
      ],
      tags: ['io.Reader', 'io.Writer', 'bufio', 'streams'],
    },
    {
      id: 'files',
      title: 'Files and resource lifetimes',
      summary: 'Read and write with explicit cleanup and error paths.',
      minutes: 18,
      objectives: [
        'Close resources after successful acquisition',
        'Use portable path construction',
      ],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'os provides filesystem operations and filepath constructs paths using platform conventions. os.ReadFile and os.WriteFile are useful for bounded files. For streaming, open a file, check the error, then defer closing the acquired handle.',
            'os.MkdirTemp creates a unique temporary directory. Clean it up when finished, and keep the path under your control. The playground filesystem belongs only to the current container and disappears afterward.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Check write and close errors when data durability matters. Successful Write does not by itself promise durable storage. Atomic replacement and synchronization require an explicit design for the target filesystem.',
            'filepath.Join cleans and combines path components but is not an authorization boundary for untrusted paths. Validate the intended containment and consider symlinks. Use fs.FS interfaces when an algorithm only needs abstract read access.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"os"
	"path/filepath"
)

func main() {

	dir, err := os.MkdirTemp("", "go-lab-")

	if err != nil {

		panic(err)

	}

	defer os.RemoveAll(dir)

	path := filepath.Join(dir, "note.txt")

	if err := os.WriteFile(path, []byte("hello"), 0600); err != nil {

		panic(err)

	}

	data, err := os.ReadFile(path)

	if err != nil {

		panic(err)

	}

	fmt.Println(string(data))

}
`,
      expectedOutput: 'hello',
      exercise: {
        prompt: 'Read the filesystem entry using the correct relative path.',
        hint: 'Paths in fs.FS use slash-separated relative names.',
        solution: go`package main

import (
	"fmt"
	"io/fs"
	"testing/fstest"
)

func main() {

	files := fstest.MapFS{"notes/go.txt": {Data: []byte("portable")}}

	data, err := fs.ReadFile(files, "notes/go.txt")

	if err != nil {

		fmt.Println("missing")

		return

	}

	fmt.Println(string(data))

}
`,
        starter: go`package main

import (
	"fmt"
	"io/fs"
	"testing/fstest"
)

func main() {

	files := fstest.MapFS{"notes/go.txt": {Data: []byte("portable")}}

	data, err := fs.ReadFile(files, "go.txt")

	if err != nil {

		fmt.Println("missing")

		return

	}

	fmt.Println(string(data))

}
`,
        expectedOutput: 'portable',
      },
      quiz: {
        question: 'Does filepath.Join alone securely confine an untrusted path?',
        options: ['Always', 'Only on Windows', 'No'],
        answer: 2,
        explanation:
          'Joining and cleaning paths is distinct from enforcing filesystem containment.',
      },
      references: [
        {
          label: 'os',
          url: 'https://pkg.go.dev/os',
        },
        {
          label: 'io/fs',
          url: 'https://pkg.go.dev/io/fs',
        },
        {
          label: 'path/filepath',
          url: 'https://pkg.go.dev/path/filepath',
        },
      ],
      tags: ['files', 'os', 'filepath', 'cleanup'],
    },
    {
      id: 'database-sql',
      title: 'Database access with database/sql',
      summary: 'Use context-aware queries, scan rows, and keep transactions bounded.',
      minutes: 20,
      objectives: [
        'Manage database handles and row lifetimes',
        'Use transactions and nullable column types deliberately',
      ],
      sections: [
        {
          title: 'Query through a driver',
          body: [
            'database/sql provides a driver-independent API; a database driver is still required by a local application. sql.Open usually configures a pool without connecting immediately, so use PingContext when startup must verify connectivity. Configure pool limits for the application instead of opening a new handle per request, and close the handle during shutdown.',
            'Pass a context to QueryContext or ExecContext so cancellation and deadlines reach the database call. Check every error, scan each row, close rows, and check rows.Err after iteration. Bind values with placeholders supported by the selected driver; do not concatenate untrusted input into SQL.',
          ],
          code: 'rows, err := db.QueryContext(ctx, query, accountID)\\nif err != nil { return err }\\ndefer rows.Close()\\nfor rows.Next() {\\n    if err := rows.Scan(&name); err != nil { return err }\\n}\\nreturn rows.Err()',
        },
        {
          title: 'Make transactions explicit',
          body: [
            'BeginTx with the request context, perform every operation in the unit of work through that sql.Tx, and commit only after all steps succeed. Defer Rollback immediately after a successful begin so early returns do not leave a transaction open; after Commit, that rollback has no effect. Treat commit errors as failures.',
            'Nullable database columns need an explicit policy. sql.NullString and related types carry a value plus a Valid flag; alternatively scan into pointers or use a domain type. This runner has no database driver or external-module downloads, so the executable sample focuses on nullable-value handling while the query pattern above is intended for a local project.',
          ],
        },
      ],
      example: go`package main

import (
	"database/sql"
	"fmt"
)

func displayName(name sql.NullString) string {
	if !name.Valid {
		return "(unknown)"
	}
	return name.String
}

func main() {
	names := []sql.NullString{
		{String: "Ada", Valid: true},
		{},
	}
	for _, name := range names {
		fmt.Println(displayName(name))
	}
}
`,
      expectedOutput: 'Ada\n(unknown)',
      exercise: {
        prompt: 'Use the fallback “guest” when the nullable database name is not valid.',
        hint: 'Check Valid before returning String.',
        starter: go`package main

import (
	"database/sql"
	"fmt"
)

func displayName(name sql.NullString) string {
	return name.String
}

func main() {
	name := sql.NullString{}
	fmt.Println(displayName(name))
}
`,
        solution: go`package main

import (
	"database/sql"
	"fmt"
)

func displayName(name sql.NullString) string {
	if !name.Valid {
		return "guest"
	}
	return name.String
}

func main() {
	name := sql.NullString{}
	fmt.Println(displayName(name))
}
`,
        expectedOutput: 'guest',
      },
      quiz: {
        question: 'What does sql.Open generally do?',
        options: [
          'Always establishes a database connection immediately',
          'Configures a database handle and connection pool',
          'Creates a database schema automatically',
        ],
        answer: 1,
        explanation:
          'The handle is usually lazy; use PingContext when you need to verify connectivity.',
      },
      references: [
        {
          label: 'database/sql',
          url: 'https://pkg.go.dev/database/sql',
        },
        {
          label: 'Managing connections',
          url: 'https://go.dev/doc/database/manage-connections',
        },
        {
          label: 'Executing transactions',
          url: 'https://go.dev/doc/database/execute-transactions',
        },
      ],
      tags: ['database/sql', 'transactions', 'context', 'SQL'],
    },
    {
      id: 'json',
      title: 'JSON v2 and validation',
      summary: 'Encode, decode, and validate data with encoding/json/v2.',
      minutes: 25,
      objectives: [
        'Encode and decode typed models with encoding/json/v2',
        'Choose strict input rules and validate domain values',
        'Choose JSON output options for your data model',
      ],
      sections: [
        {
          title: 'Use the v2 standard-library API',
          body: [
            'Go 1.27 includes encoding/json/v2 and encoding/json/jsontext by default. This course uses Go 1.27.4, so no GOEXPERIMENT=jsonv2 setting or external module is needed. Import encoding/json/v2; its package name is still json.',
            'Marshal and Unmarshal work with byte slices; MarshalWrite and UnmarshalRead write to an io.Writer or read from an io.Reader. Pass options directly to these functions. Exported struct fields participate, and json tags define their JSON names. Always check errors before using decoded data.',
          ],
        },
        {
          title: 'Choose strict input rules',
          body: [
            'V2 rejects duplicate object names and invalid UTF-8 by default. Field matching is case-sensitive: a field tagged json:"name" matches name, not Name. Unknown members are still ignored by default; add json.RejectUnknownMembers(true) to reject misspellings and unexpected fields.',
            'Decoding does not enforce domain rules: a score can decode successfully and still be negative. Decode into a fresh value, check the error, then validate required fields and ranges. Use pointers when absence must differ from a zero value; distinguishing missing from explicit null needs a separate presence model.',
            'When decoding into any, JSON numbers become float64, which can lose integer precision. Prefer concrete integer fields for exact IDs and counters. Exercise your model with representative inputs, including duplicates, field case, unknown members, nil collections, and zero values.',
          ],
        },
        {
          title: 'Read one document or a stream',
          body: [
            'UnmarshalRead requires exactly one JSON value and reads through EOF, allowing surrounding whitespace but rejecting trailing values or junk. Bound an HTTP body with http.MaxBytesReader before passing it to UnmarshalRead. An open-ended stream needs a different approach because waiting for EOF may block.',
            'For a sequence of values, create a jsontext.Decoder and call json.UnmarshalDecode repeatedly until io.EOF. MarshalEncode similarly writes through a jsontext.Encoder. The jsontext package also exposes tokens and raw values for syntax-level work. MarshalWrite does not add a newline.',
          ],
        },
        {
          title: 'Choose the encoded output',
          body: [
            'V2 encodes a nil []string as [] and a nil map as {}. Use FormatNilSliceAsNull(true) or FormatNilMapAsNull(true) only when that is the intended contract. Map order is unspecified by default; json.Deterministic(true) makes output repeatable, but does not promise canonical JSON.',
            'The v2 omitempty tag omits fields whose JSON representation is null, an empty string, array, or object. It does not omit false or 0. Use omitzero to omit Go zero values, including types with an IsZero method. Test these choices against the consumers of your JSON.',
          ],
        },
      ],
      example: go`package main

import (
	"encoding/json/v2"
	"fmt"
	"strings"
)

type Profile struct {
	Name  string   ${'`'}json:"name"${'`'}
	Score int      ${'`'}json:"score"${'`'}
	Tags  []string ${'`'}json:"tags"${'`'}
}

func main() {
	var p Profile
	input := strings.NewReader("{\"name\":\"Ada\",\"score\":42}")
	if err := json.UnmarshalRead(input, &p, json.RejectUnknownMembers(true)); err != nil {
		panic(err)
	}
	if strings.TrimSpace(p.Name) == "" || p.Score < 0 {
		panic("name required and score must be non-negative")
	}
	fmt.Println(p.Name, p.Score)

	encoded, err := json.Marshal(p)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(encoded))

	var duplicate Profile
	err = json.Unmarshal([]byte("{\"name\":\"Ada\",\"name\":\"Grace\"}"), &duplicate)
	fmt.Println("duplicate rejected:", err != nil)
}
`,
      expectedOutput: 'Ada 42\n{"name":"Ada","score":42,"tags":[]}\nduplicate rejected: true',
      exercise: {
        prompt:
          'Complete decodeName so it accepts exactly one JSON document with a non-blank name, rejects unknown members, and returns the trimmed name. Keep the v2 defaults for duplicate names and field matching.',
        hint: 'Pass json.RejectUnknownMembers(true) to UnmarshalRead, return decoding errors, then trim and validate Name. UnmarshalRead already rejects a trailing value.',
        solution: go`package main

import (
	"encoding/json/v2"
	"fmt"
	"strings"
)

func decodeName(input string) (string, error) {
	var value struct {
		Name string ${'`'}json:"name"${'`'}
	}
	if err := json.UnmarshalRead(strings.NewReader(input), &value, json.RejectUnknownMembers(true)); err != nil {
		return "", err
	}
	name := strings.TrimSpace(value.Name)
	if name == "" {
		return "", fmt.Errorf("name required")
	}
	return name, nil
}

func main() {
	for _, input := range []string{
		"{\"name\":\" Ada \"}",
		"{\"name\":\"Ada\",\"extra\":1}",
		"{\"Name\":\"Ada\"}",
		"{\"name\":\"Ada\",\"name\":\"Grace\"}",
		"{\"name\":\"Ada\"} {}",
		"{\"name\":\" \"}",
		"{}",
	} {
		name, err := decodeName(input)
		if err != nil {
			fmt.Println("rejected")
		} else {
			fmt.Println("accepted:", name)
		}
	}
}
`,
        starter: go`package main

import (
	"encoding/json/v2"
	"fmt"
	"strings"
)

func decodeName(input string) (string, error) {
	var value struct {
		Name string ${'`'}json:"name"${'`'}
	}
	// TODO: reject unknown members.
	if err := json.UnmarshalRead(strings.NewReader(input), &value); err != nil {
		return "", err
	}
	// TODO: trim the name and reject a blank or missing name.
	return value.Name, nil
}

func main() {
	for _, input := range []string{
		"{\"name\":\" Ada \"}",
		"{\"name\":\"Ada\",\"extra\":1}",
		"{\"Name\":\"Ada\"}",
		"{\"name\":\"Ada\",\"name\":\"Grace\"}",
		"{\"name\":\"Ada\"} {}",
		"{\"name\":\" \"}",
		"{}",
	} {
		name, err := decodeName(input)
		if err != nil {
			fmt.Println("rejected")
		} else {
			fmt.Println("accepted:", name)
		}
	}
}
`,
        expectedOutput: 'accepted: Ada\nrejected\nrejected\nrejected\nrejected\nrejected\nrejected',
      },
      quiz: {
        question: 'Which input rule needs an explicit option when decoding a struct with JSON v2?',
        options: [
          'Reject duplicate object names',
          'Reject unknown object members',
          'Reject invalid UTF-8',
        ],
        answer: 1,
        explanation:
          'V2 rejects duplicate names and invalid UTF-8 by default. Unknown members require RejectUnknownMembers(true), and domain rules still need explicit validation.',
      },
      references: [
        {
          label: 'encoding/json/v2',
          url: 'https://pkg.go.dev/encoding/json/v2',
        },
        {
          label: 'encoding/json/jsontext',
          url: 'https://pkg.go.dev/encoding/json/jsontext',
        },
        {
          label: 'Go 1.27 release notes',
          url: 'https://go.dev/doc/go1.27',
        },
      ],
      tags: ['JSON', 'json/v2', 'jsontext', 'validation', 'encoding'],
    },
    {
      id: 'time',
      title: 'Time, durations, and deadlines',
      summary: 'Represent elapsed time and timestamps without fragile string rules.',
      minutes: 18,
      objectives: [
        'Parse a timestamp with a layout',
        'Distinguish durations from calendar arithmetic',
      ],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'time.Time represents an instant with location information, while time.Duration represents a nanosecond count. Parse and Format use a reference date layout, not strftime tokens. time.RFC3339 is a standard layout for interoperable timestamps.',
            'Use time.Since(start) for elapsed time in a process. Where available, the monotonic clock component helps avoid wall-clock adjustments. Use AddDate for calendar changes and Add for elapsed durations; a local calendar day can differ from 24 hours around daylight-saving transitions.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Avoid sleeping to coordinate goroutines or make tests pass. Use channels, synchronization, or cancellation instead. Stop tickers when they are no longer needed and structure shutdown explicitly.',
            'Parsing a timestamp without a zone needs a defined location policy. Keep example output deterministic with a fixed instant instead of time.Now, and compare instants with Equal rather than relying on struct equality.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"time"
)

func main() {

	start, err := time.Parse(time.RFC3339, "2026-11-13T10:00:00Z")

	if err != nil {

		panic(err)

	}

	fmt.Println(start.Add(90 * time.Minute).Format(time.RFC3339))

}
`,
      expectedOutput: '2026-11-13T11:30:00Z',
      exercise: {
        prompt: 'Add 45 minutes to the fixed start.',
        hint: 'Multiply by time.Minute, not time.Second.',
        solution: go`package main

import (
	"fmt"
	"time"
)

func main() {

	start := time.Date(2026, 11, 13, 10, 0, 0, 0, time.UTC)

	fmt.Println(start.Add(45 * time.Minute).Format("15:04"))

}
`,
        starter: go`package main

import (
	"fmt"
	"time"
)

func main() {

	start := time.Date(2026, 11, 13, 10, 0, 0, 0, time.UTC)

	fmt.Println(start.Add(45 * time.Second).Format("15:04"))

}
`,
        expectedOutput: '10:45',
      },
      quiz: {
        question: 'Which operation expresses a calendar-day change?',
        options: ['Always Add(24*time.Hour)', 'AddDate', 'String concatenation'],
        answer: 1,
        explanation:
          'Calendar arithmetic must account for the location and possible daylight-saving transitions.',
      },
      references: [
        {
          label: 'time',
          url: 'https://pkg.go.dev/time',
        },
      ],
      tags: ['time', 'duration', 'RFC3339', 'deadlines'],
    },
  ],
};
