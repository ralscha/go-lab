import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { loadCourse } from './load-course.mjs';
const run = promisify(execFile);
const modules = await loadCourse();
const ids = new Set();
const jobs = [];
const normalize = (text) => text.replace(/\r\n/g, '\n').trimEnd();
for (const module of modules) {
  assert(module.lessons.length > 0);
  for (const lesson of module.lessons) {
    assert(!ids.has(lesson.id), `duplicate ${lesson.id}`);
    ids.add(lesson.id);
    assert(lesson.objectives.length >= 2 && lesson.sections.length >= 2, lesson.id);
    assert(lesson.quiz.answer >= 0 && lesson.quiz.answer < lesson.quiz.options.length, lesson.id);
    assert(lesson.exercise.starter !== lesson.exercise.solution, lesson.id);
    for (const ref of lesson.references)
      assert(['go.dev', 'pkg.go.dev'].includes(new URL(ref.url).hostname));
    jobs.push({
      id: lesson.id,
      kind: 'example',
      code: lesson.example,
      mode: lesson.mode ?? 'run',
      expected: lesson.expectedOutput,
    });
    jobs.push({
      id: lesson.id,
      kind: 'solution',
      code: lesson.exercise.solution,
      mode: lesson.exercise.mode ?? lesson.mode ?? 'run',
      expected: lesson.exercise.expectedOutput,
    });
  }
}
// Only repository-authored snippets run here. Browser submissions always use Docker.
const env = {
  ...process.env,
  GOCACHE: path.resolve('.artifacts/go-cache'),
  GOTOOLCHAIN: 'local',
  GOPROXY: 'off',
  GOSUMDB: 'off',
};
let passed = 0;
async function worker() {
  while (jobs.length) {
    const job = jobs.shift();
    const dir = path.resolve('.artifacts/course-check', job.id + '-' + job.kind);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'go.mod'), 'module coursecheck\n\ngo 1.27.4\n');
    const file = job.mode === 'test' ? 'main_test.go' : 'main.go';
    await fs.writeFile(path.join(dir, file), job.code);
    try {
      const { stdout } = await run(
        'go',
        job.mode === 'test' ? ['test', '-count=1', '.'] : ['run', '.'],
        { cwd: dir, env, timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true },
      );
      if (job.expected !== undefined) assert.equal(normalize(stdout), normalize(job.expected));
      passed++;
    } catch (error) {
      throw new Error(`${job.id} ${job.kind}: ${error.stderr ?? error.message}`, { cause: error });
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
console.log(
  `Verified ${modules.length} chapters, ${ids.size} lessons, and ${passed} Go examples/solutions.`,
);
