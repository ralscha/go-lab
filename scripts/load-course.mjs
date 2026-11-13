import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
export async function loadCourse() {
  const target = path.resolve('.artifacts/course');
  await fs.mkdir(target, { recursive: true });
  for (const file of await fs.readdir('src/app/content')) {
    if (!file.endsWith('.ts')) continue;
    const input = await fs.readFile(path.join('src/app/content', file), 'utf8');
    const output = ts.transpileModule(input, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    await fs.writeFile(
      path.join(target, file.replace(/\.ts$/, '.mjs')),
      output.replace(/from (['"])(\.\.?\/[^'"]+)\1/g, 'from $1$2.mjs$1'),
    );
  }
  return (await import(pathToFileURL(path.join(target, 'index.mjs')).href)).courseModules;
}
