import { mkdir, writeFile } from 'node:fs/promises';
import { loadFixtures, loadScorebook, validateProject } from './lib.mjs';
import { adaptBookForLegacyValidation, validateSourcePolicy } from './source-policy.mjs';

const [{ data: book }, { data: fixtureBook }] = await Promise.all([
  loadScorebook(),
  loadFixtures(),
]);

const structural = validateProject(adaptBookForLegacyValidation(book), fixtureBook);
const sourcePolicy = validateSourcePolicy(book);
const result = {
  pass: structural.pass && sourcePolicy.pass,
  errors: [...structural.errors, ...sourcePolicy.errors],
  warnings: [...structural.warnings, ...sourcePolicy.warnings],
  counts: {
    ...structural.counts,
    sourcePolicySongs: sourcePolicy.counts.checkedSongs,
  },
};

await mkdir('reports', { recursive: true });
await writeFile('reports/gate-report.json', `${JSON.stringify(result, null, 2)}\n`);

const markdown = [
  '# Gate Report',
  '',
  `**Result: ${result.pass ? 'PASS' : 'FAIL'}**`,
  '',
  `- Verified public songs: ${result.counts?.verifiedSongs ?? 0}`,
  `- Source-policy songs checked: ${result.counts?.sourcePolicySongs ?? 0}`,
  `- Quarantined legacy entries: ${result.counts?.quarantinedEntries ?? 0}`,
  `- Synthetic fixtures: ${result.counts?.fixtures ?? 0}`,
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
