import { mkdir, writeFile } from 'node:fs/promises';
import { loadScorebook, validateScorebook } from './lib.mjs';

const { data } = await loadScorebook();
const result = validateScorebook(data);

await mkdir('reports', { recursive: true });
await writeFile('reports/gate-report.json', `${JSON.stringify(result, null, 2)}\n`);

const markdown = [
  '# Gate Report',
  '',
  `**Result: ${result.pass ? 'PASS' : 'FAIL'}**`,
  '',
  `- Errors: ${result.errors.length}`,
  `- Warnings: ${result.warnings.length}`,
  '',
  '## Errors',
  '',
  ...(result.errors.length
    ? result.errors.map((item) => `- \`${item.code}\` ${item.path}: ${item.message}`)
    : ['- None']),
  '',
  '## Warnings',
  '',
  ...(result.warnings.length
    ? result.warnings.map((item) => `- \`${item.code}\` ${item.path}: ${item.message}`)
    : ['- None']),
  '',
].join('\n');

await writeFile('reports/gate-report.md', markdown);
console.log(markdown);

if (!result.pass) process.exitCode = 1;
