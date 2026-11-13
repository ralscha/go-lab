# go-lab

An interactive Go course modeled on the sibling `rust-lab`: **Angular 22**, **TypeScript**, **CodeMirror 6**, and a **Go standard-library backend**. The course contains **44 lessons in 10 chapters**, with runnable examples, exercises, hints, complete solutions, quizzes, and official documentation links.

The baseline is **Go 1.27.4**, verified on **13 November 2026** against [Go downloads](https://go.dev/dl/). The runner image uses that exact release. `go.mod` declares the minimum required version; `.go-version` records the intended host toolchain. There are no third-party Go dependencies.

## Run locally

Install Go 1.27.4, a Node version supported by `package.json` (Node 26 recommended), npm, and Docker with **Linux containers**. Start Docker, then:

```sh
npm ci
npm run runner:build
npm start
```

Open **http://127.0.0.1:4201**. Angular proxies `/api` to the Go backend at **127.0.0.1:3002**. These ports differ from `rust-lab`, so both applications can run together. Ctrl+C stops both development processes. Angular reloads frontend changes; restart after backend changes.

The initial image build downloads Go and warms normal and race-enabled standard-library caches. Subsequent playground operations work offline. A missing Docker daemon or image produces a setup error; submitted code is never executed on the host as a fallback.

For a production build served locally:

```sh
npm run build
npm run serve
```

Open **http://127.0.0.1:3002**. `build` creates `dist/go-lab/browser` and `bin/server` (`bin/server.exe` on Windows). The compiled binary can be launched directly from the repository root. Do not run development and production servers on port 3002 simultaneously.

## Learn and experiment

- Search chapters, titles, summaries, and tags. Use `/` to focus search.
- Run an example with **Ctrl+Enter / Cmd+Enter** and inspect output and diagnostics separately.
- Choose **Run** or **Test**, with normal compilation or the **race detector**.
- Format with `gofmt`, reset the editor, or download `main.go` / `main_test.go`.
- Try exercises, reveal hints, and compare a complete solution. Output exercises compare stdout, ignoring trailing whitespace; matching output alone does not prove general correctness.
- Test lessons run Go tests, examples, and fuzz seeds. Fuzz generation and benchmark timing are local terminal activities described in the lessons.
- Save per-lesson notes and completion state. Drafts, notes, progress, and the last lesson persist in this browser’s local storage, separately from `rust-lab`. They do not sync between devices. Lesson links do not include code.
- Use the independent Playground and the Field notes reference page.

## Curriculum

1. **Start with Go:** toolchain, first program, modules, multi-package project layout, and feedback loops.
2. **Language essentials:** variables, constants, control flow, functions, closures, and defer.
3. **Collections and text:** arrays, slices, maps, Unicode, and shared storage.
4. **Types, interfaces, and errors:** pointers, structs, method sets, typed nil, and error wrapping.
5. **Generics and iteration:** type parameters, constraints, collection helpers, and iterator functions.
6. **Standard library:** streaming I/O, files, database/sql, JSON validation, and time.
7. **Concurrency:** goroutines, channels, cancellation, mutexes, atomics, and race detection.
8. **Test and measure:** table tests, executable examples, fuzz properties, and benchmarks.
9. **Build useful programs:** package boundaries, flags, HTTP handlers and lifecycle, structured logs, and profiling.
10. **Capstones:** validated record parser, word report, tested JSON endpoint, and bounded worker pipeline.

The course teaches core language and practical library use, not every API or ecosystem. HTTP examples use `httptest` without opening network connections.

## Authoritative references

- [Go documentation](https://go.dev/doc/)
- [Language specification](https://go.dev/ref/spec)
- [Effective Go](https://go.dev/doc/effective_go) — useful core idioms; supplement its older material with current module and generics documentation.
- [Standard library](https://pkg.go.dev/std)

Each lesson links directly to relevant official pages.

## Runner and API

```text
Angular browser → local Go API → disposable Docker container → Go 1.27.4
```

The runner supports a single file using the standard library. Test mode places the entire submission in `main_test.go`. External modules, interactive stdin, persistent files, and network access are outside its interface.

Each job runs as UID/GID 10001 with no network, no Linux capabilities, no host mounts, a read-only root filesystem, and `no-new-privileges`. It receives one CPU, 768 MiB RAM, 128 processes/threads, a 256 MiB executable work tmpfs, and a 64 MiB non-executable temporary tmpfs. Source arrives over stdin. Jobs have a 30-second internal deadline, a 35-second backend deadline, and a combined 1 MiB output limit. The backend removes containers on completion, cancellation, and overflow, holding its admission slot through cleanup.

The API accepts at most four simultaneous jobs, 30 requests per client IP per minute, 64 KiB JSON bodies, and 48 KiB source. Host and browser-origin checks protect the local API; proxy-supplied client IP headers are not trusted. Containers share a kernel. Keep this local learning runner behind a trusted boundary; public multi-user execution needs a separately designed sandbox and access controls.

| Endpoint            | Contract                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`   | Backend health and limits; does not probe Docker.                                                                             |
| `GET /api/version`  | Actual Docker compiler version.                                                                                               |
| `POST /api/execute` | JSON `{ "code": "...", "mode": "run", "optimization": "default" }`. Mode: `run` or `test`; optimization: `default` or `race`. |
| `POST /api/format`  | JSON `{ "code": "..." }`; preserves submitted source on failure.                                                              |

Execution returns `success`, `stdout`, `stderr`, and `elapsedMs`. Compiler/runtime failures return HTTP 200 with `success: false`; invalid requests and unavailable infrastructure return HTTP errors with an `error` message. Unknown request fields are rejected.

| Environment variable | Default                                                  |
| -------------------- | -------------------------------------------------------- |
| `HOST`               | `127.0.0.1`                                              |
| `PORT`               | `3002`                                                   |
| `STATIC_ROOT`        | `dist/go-lab/browser`, relative to the working directory |
| `RUNNER_IMAGE`       | `go-lab-runner:1.27.4`                                   |
| `ALLOWED_ORIGINS`    | `http://localhost:4201,http://127.0.0.1:4201`            |

For a trusted reverse proxy, set `ALLOWED_ORIGINS` to the exact external origins (including non-default ports); their hosts are also admitted by the Host check. This replaces the development origin list. Image overrides must be trusted images implementing `runner/run.sh`’s protocol and isolation assumptions.

## Verification

```sh
npm test
go vet ./...
npm run format:check
npm run build
npm run test:ui
```

`npm test` runs backend tests and compiles/runs all **88 curated examples and solutions** with the host Go toolchain. This developer-only checker runs repository-authored code; it never accepts browser submissions. Artifacts stay in ignored `.artifacts/` directories.

Docker integration checks are opt-in:

```powershell
$env:GO_LAB_DOCKER_TEST = '1'
go test ./server -run TestDockerIntegration -v
Remove-Item Env:GO_LAB_DOCKER_TEST
```

On POSIX shells use `GO_LAB_DOCKER_TEST=1 go test ./server -run TestDockerIntegration -v`. The suite checks execution, tests, formatting, race mode, errors, non-root/read-only operation, cancellation, and output limits.

UI tests use installed Microsoft Edge on Windows. On Linux/macOS, first run `npx playwright install chromium`. Build the frontend and runner before UI tests. Playwright starts and stops its own backend; port 3002 must be free. Screenshots go to `.artifacts/` and failure traces to `test-results/`.

## Source layout

`src/app/content/` contains explicit, typed chapter/lesson objects with formatted Go snippets. `state/` owns navigation and editing state, `services/` owns storage and API transport, and `features/` contains the course views. `server/` contains the API, static serving, runner, and tests. `runner/` defines the disposable execution image; `scripts/` provides development and curriculum verification commands.
