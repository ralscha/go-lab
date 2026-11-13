import type { CourseModule } from '../course.model';
const go = String.raw;

export const stdlib: CourseModule = {
  id: 'stdlib',
  title: 'The standard library',
  level: 'Intermediate',
  description: 'Readers, files, JSON, and time without external dependencies.',
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
      title: 'JSON and validation',
      summary: 'Separate decoding a representation from accepting its meaning.',
      minutes: 18,
      objectives: ['Use exported fields in JSON models', 'Validate decoded input'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'encoding/json maps JSON to Go values. Exported struct fields participate, and json tags can control their names. Unmarshal decodes a byte slice; Decoder reads from an io.Reader. Always check errors before trusting decoded values.',
            'Decoding establishes a representation, not your domain rules. A successfully decoded age can still be negative. Use explicit validation after decoding, and decide whether missing fields need to be distinguished from zero values through pointers or a separate presence model.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'When decoding into any, JSON numbers normally become float64. Use Decoder.UseNumber when preserving numeric text matters. DisallowUnknownFields rejects unexpected object fields when decoding into structs.',
            'Decoder.Decode reads one value. For an endpoint requiring exactly one JSON value, attempt another decode and require io.EOF. Bound request size before decoding. Avoid treating arbitrary input as trusted configuration.',
          ],
        },
      ],
      example: go`package main

import (
	"encoding/json"
	"fmt"
)

type Profile struct {
	Name  string
	Score int
}

func main() {

	var p Profile

	if err := json.Unmarshal([]byte("{\"name\":\"Ada\",\"score\":42}"), &p); err != nil {

		panic(err)

	}

	fmt.Println(p.Name, p.Score)

}
`,
      expectedOutput: 'Ada 42',
      exercise: {
        prompt: 'Reject an unexpected JSON field.',
        hint: 'Enable DisallowUnknownFields before Decode.',
        solution: go`package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

func main() {

	var value struct{ Name string }

	d := json.NewDecoder(strings.NewReader("{\"Name\":\"Ada\",\"extra\":1}"))

	d.DisallowUnknownFields()

	err := d.Decode(&value)

	fmt.Println(err != nil)

}
`,
        starter: go`package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

func main() {

	var value struct{ Name string }

	d := json.NewDecoder(strings.NewReader("{\"Name\":\"Ada\",\"extra\":1}"))
	/* TODO: reject unknown fields*/
	err := d.Decode(&value)

	fmt.Println(err != nil)

}
`,
        expectedOutput: 'true',
      },
      quiz: {
        question: 'Does successful JSON decoding validate domain rules?',
        options: ['Always', 'No', 'Only for exported fields'],
        answer: 1,
        explanation: 'Decoding and semantic validation are separate steps.',
      },
      references: [
        {
          label: 'encoding/json',
          url: 'https://pkg.go.dev/encoding/json',
        },
      ],
      tags: ['JSON', 'validation', 'encoding'],
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
