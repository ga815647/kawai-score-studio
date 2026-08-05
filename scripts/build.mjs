import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { loadScorebook, validateScorebook } from './lib.mjs';

const { source, data } = await loadScorebook();
const validation = validateScorebook(data);
if (!validation.pass) {
  console.error('Content Gate failed. Run npm run validate for details.');
  process.exit(1);
}

const hash = createHash('sha256').update(source).digest('hex');
const template = await readFile('src/index.template.html', 'utf8');
const html = template
  .replaceAll('{{SCOREBOOK_VERSION}}', data.project.version)
  .replaceAll('{{SCOREBOOK_SHA256}}', hash);

const noteBox = data.notation.note_box;
const octaveDot = data.notation.octave_dot;
const designCss = `:root {
  --note-box-width: ${noteBox.width_px}px;
  --note-box-height: ${noteBox.height_px}px;
  --note-box-border-width: ${noteBox.border_width_px}px;
  --note-box-border-radius: ${noteBox.border_radius_px}px;
  --note-box-vertical-padding: ${noteBox.vertical_padding_px}px;
  --octave-dot-diameter: ${octaveDot.diameter_px}px;
  --octave-dot-min-border-clearance: ${octaveDot.min_border_clearance_px}px;
  --octave-dot-number-clearance: ${octaveDot.min_number_clearance_px}px;
}
`;

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
await writeFile('dist/design.css', designCss);
await writeFile('dist/scorebook.json', `${JSON.stringify(data, null, 2)}\n`);
await writeFile('dist/gate-report.json', `${JSON.stringify(validation, null, 2)}\n`);
await cp('src/app.js', 'dist/app.js');
await cp('src/styles.css', 'dist/styles.css');

console.log(`Built dist/ from scorebook ${data.project.version} (${hash.slice(0, 12)})`);
