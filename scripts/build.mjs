import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { loadFixtures, loadScorebook, validateProject } from './lib.mjs';

const [scorebookResult, fixtureResult] = await Promise.all([
  loadScorebook(),
  loadFixtures(),
]);
const { source, data: book } = scorebookResult;
const { data: fixtureBook } = fixtureResult;
const validation = validateProject(book, fixtureBook);
if (!validation.pass) {
  console.error('Required Gate failed. Run npm run validate for details.');
  process.exit(1);
}

const vexflowPackage = JSON.parse(await readFile('node_modules/vexflow/package.json', 'utf8'));
if (vexflowPackage.version !== book.rendering.staff.version) {
  throw new Error(`VexFlow ${vexflowPackage.version} does not match ${book.rendering.staff.version}`);
}

const hash = createHash('sha256').update(source).digest('hex');
const template = await readFile('src/index.template.html', 'utf8');
const html = template
  .replaceAll('{{SCOREBOOK_VERSION}}', book.project.version)
  .replaceAll('{{SCOREBOOK_SHA256}}', hash);

const page = book.layout.page;
const typography = book.layout.typography;
const designCss = `:root {
  --page-width: ${page.width_mm}mm;
  --page-height: ${page.height_mm}mm;
  --page-margin: ${page.margin_mm}mm;
  --staff-width: 700px;
  --note-number-size: ${typography.note_number_px}px;
  --lyric-size: ${typography.lyric_px}px;
  --octave-dot-size: ${book.notation.octave_dot.diameter_px}px;
}
`;

await rm('dist', { recursive: true, force: true });
await mkdir('dist/vendor', { recursive: true });
await writeFile('dist/index.html', html);
await writeFile('dist/design.css', designCss);
await writeFile('dist/scorebook.json', `${JSON.stringify(book, null, 2)}\n`);
await writeFile('dist/fixtures.json', `${JSON.stringify(fixtureBook, null, 2)}\n`);
await writeFile('dist/gate-report.json', `${JSON.stringify(validation, null, 2)}\n`);
for (const file of ['app.js', 'audio.js', 'score-engine.js', 'staff-renderer.js', 'styles.css']) {
  await cp(`src/${file}`, `dist/${file}`);
}
await cp('node_modules/vexflow/build/cjs/vexflow.js', 'dist/vendor/vexflow.js');

console.log(
  `Built dist/ from scorebook ${book.project.version} (${hash.slice(0, 12)}); `
  + `${validation.counts.verifiedSongs} verified songs, ${validation.counts.fixtures} fixtures`,
);
