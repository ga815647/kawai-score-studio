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
const geometry = book.layout.system_geometry;
const collision = geometry.collision_adjustment;
const designCss = `:root {
  --page-width: ${page.width_mm}mm;
  --page-height: ${page.height_mm}mm;
  --page-margin: ${page.margin_mm}mm;
  --staff-width: ${geometry.staff_width_px}px;
  --staff-canvas-height: ${geometry.staff_canvas_height_px}px;
  --stave-top-line-y: ${geometry.stave_top_line_y_px}px;
  --numbered-row-height: ${geometry.numbered_row_height_px}px;
  --numbered-staff-gap: ${geometry.numbered_to_staff_top_line_gap_px}px;
  --lyric-staff-gap: ${geometry.lyric_row.staff_bottom_line_to_top_px}px;
  --lyric-line-height: ${geometry.lyric_row.line_height_px}px;
  --lyric-alignment-tolerance: ${geometry.lyric_row.max_vertical_alignment_delta_px}px;
  --glyph-collision-clearance: ${collision.glyph_clearance_px}px;
  --maximum-event-vertical-shift: ${collision.maximum_shift_px}px;
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
