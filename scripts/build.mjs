import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { loadScorebook, validateScorebook } from './lib.mjs';

const { source, data } = await loadScorebook();
const validation = validateScorebook(data);
if (!validation.pass) {
  console.error('Content Gate failed. Run npm run validate for details.');
  process.exit(1);
}

const vexflowPackage = JSON.parse(await readFile('node_modules/vexflow/package.json', 'utf8'));
if (vexflowPackage.version !== data.rendering.staff.version) {
  throw new Error(
    `VexFlow version mismatch: installed ${vexflowPackage.version}, expected ${data.rendering.staff.version}`,
  );
}

const hash = createHash('sha256').update(source).digest('hex');
const template = await readFile('src/index.template.html', 'utf8');
const html = template
  .replaceAll('{{SCOREBOOK_VERSION}}', data.project.version)
  .replaceAll('{{SCOREBOOK_SHA256}}', hash);

const page = data.layout.page;
const title = data.layout.title;
const system = data.layout.notation_system;
const numberedNotation = system.numbered_notation;
const staff = system.staff;
const alignment = system.alignment;
const numberedNote = data.notation.numbered_note;
const octaveDot = data.notation.octave_dot;
const typography = data.notation.typography;
const designCss = `:root {
  --page-width: ${page.width_mm}mm;
  --page-height: ${page.height_mm}mm;
  --page-margin: ${page.margin_mm}mm;
  --title-max-width: ${title.max_width_percent}%;
  --system-gap: ${system.system_gap_px}px;
  --max-events-per-system: ${system.max_events_per_system};
  --numbered-note-row-height: ${numberedNotation.note_row_height_px}px;
  --numbered-lyric-top: ${numberedNotation.lyric_top_px}px;
  --staff-pull-up: ${numberedNotation.staff_pull_up_px}px;
  --min-lyric-staff-gap: ${numberedNotation.min_lyric_to_staff_content_gap_px}px;
  --max-lyric-staff-gap: ${numberedNotation.max_lyric_to_staff_content_gap_px}px;
  --staff-width: ${staff.width_px}px;
  --staff-height: ${staff.height_px}px;
  --staff-alignment-tolerance: ${alignment.tolerance_px}px;
  --numbered-note-width: ${numberedNote.width_px}px;
  --numbered-note-stack-height: ${numberedNote.stack_height_px}px;
  --octave-dot-diameter: ${octaveDot.diameter_px}px;
  --octave-dot-number-clearance: ${octaveDot.min_number_clearance_px}px;
  --note-number-size: ${typography.note_number_px}px;
  --lyric-size: ${typography.lyric_px}px;
}
`;

await rm('dist', { recursive: true, force: true });
await mkdir('dist/vendor', { recursive: true });
await writeFile('dist/index.html', html);
await writeFile('dist/design.css', designCss);
await writeFile('dist/scorebook.json', `${JSON.stringify(data, null, 2)}\n`);
await writeFile('dist/gate-report.json', `${JSON.stringify(validation, null, 2)}\n`);
await cp('src/app.js', 'dist/app.js');
await cp('src/layout.js', 'dist/layout.js');
await cp('src/staff-model.js', 'dist/staff-model.js');
await cp('src/staff-renderer.js', 'dist/staff-renderer.js');
await cp('src/styles.css', 'dist/styles.css');
await cp('node_modules/vexflow/build/cjs/vexflow.js', 'dist/vendor/vexflow.js');

console.log(
  `Built dist/ from scorebook ${data.project.version} (${hash.slice(0, 12)}) with VexFlow ${vexflowPackage.version}`,
);
