import { execFileSync } from 'node:child_process';
const output = execFileSync('gofmt', ['-l', 'server'], { encoding: 'utf8' });
if (output.trim()) {
  console.error(output);
  process.exitCode = 1;
}
