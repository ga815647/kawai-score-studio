import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadScorebook, parsePitch, validateScorebook } from '../scripts/lib.mjs';

test('scorebook passes content gate', async () => {
  const { data } = await loadScorebook();
  const result = validateScorebook(data);
  assert.equal(result.pass, true, JSON.stringify(result.errors, null, 2));
});

test('instrument has the expected 16-note range', async () => {
  const { data } = await loadScorebook();
  assert.deepEqual(data.instrument.keys, [
    '4_', '5_', '6_', '7_', '1', '2', '3', '4',
    '5', '6', '7', '1^', '2^', '3^', '4^', '5^',
  ]);
});

test('octave dots use the approved visual rule', async () => {
  const { data } = await loadScorebook();
  assert.deepEqual(data.notation.note_box, {
    width_px: 58,
    height_px: 80,
    border_width_px: 3,
    border_radius_px: 15,
    vertical_padding_px: 5,
  });
  assert.deepEqual(data.notation.octave_dot, {
    shape: 'circle',
    diameter_px: 10,
    min_border_clearance_px: 8,
    min_number_clearance_px: 4,
  });
  assert.deepEqual(data.notation.upper_dot, {
    location: 'inside_box',
    alignment: 'centered_above_number',
    color: 'inherit',
  });
  assert.deepEqual(data.notation.lower_dot, {
    location: 'inside_box',
    alignment: 'centered_below_number',
    color: 'inherit',
  });
});

test('octave dot geometry reserves border and number clearances', async () => {
  const { data } = await loadScorebook();
  const box = data.notation.note_box;
  const dot = data.notation.octave_dot;
  const borderClearance = box.border_width_px + box.vertical_padding_px;
  const innerHeight = box.height_px - box.border_width_px * 2 - box.vertical_padding_px * 2;
  const numberRowHeight = innerHeight - dot.diameter_px * 2 - dot.min_number_clearance_px * 2;

  assert.ok(dot.diameter_px > 7, 'dot must be visibly larger than the previous glyph');
  assert.ok(borderClearance >= dot.min_border_clearance_px);
  assert.ok(dot.min_number_clearance_px >= 4);
  assert.ok(numberRowHeight > 0, 'number row must remain separate from both dots');
});

test('generated HTML design contract comes from scorebook', async () => {
  const { data } = await loadScorebook();
  const [designCss, styles, app, html] = await Promise.all([
    readFile('dist/design.css', 'utf8'),
    readFile('src/styles.css', 'utf8'),
    readFile('src/app.js', 'utf8'),
    readFile('dist/index.html', 'utf8'),
  ]);

  assert.match(designCss, new RegExp(`--note-box-height: ${data.notation.note_box.height_px}px;`));
  assert.match(designCss, new RegExp(`--note-box-vertical-padding: ${data.notation.note_box.vertical_padding_px}px;`));
  assert.match(designCss, new RegExp(`--octave-dot-diameter: ${data.notation.octave_dot.diameter_px}px;`));
  assert.match(designCss, new RegExp(`--octave-dot-number-clearance: ${data.notation.octave_dot.min_number_clearance_px}px;`));
  assert.match(html, /href="\.\/design\.css"/);
  assert.match(styles, /row-gap:\s*var\(--octave-dot-number-clearance, 4px\)/);
  assert.match(styles, /\.octave-dot--active\s*\{\s*background:\s*currentColor;/);
  assert.match(app, /classList\.add\('octave-dot--active'\)/);
  assert.doesNotMatch(app, /●/);
});

test('all required gates include visual and print checks', async () => {
  const { data } = await loadScorebook();
  for (const gate of ['content', 'html', 'visual', 'print', 'release']) {
    assert.equal(data.gates[gate].required, true, `${gate} gate must be required`);
  }
  assert.ok(data.gates.visual.checks.includes('octave_dot_does_not_touch_note_box'));
  assert.ok(data.gates.visual.checks.includes('octave_dot_does_not_touch_note_number'));
});

test('every rendered event pitch is parseable and playable', async () => {
  const { data } = await loadScorebook();
  const playable = new Set(data.instrument.keys);
  for (const song of data.songs) {
    for (const phrase of song.phrases) {
      for (const event of phrase.events) {
        assert.ok(parsePitch(event.pitch), `${song.title}: invalid ${event.pitch}`);
        assert.ok(playable.has(event.pitch), `${song.title}: unavailable ${event.pitch}`);
      }
    }
  }
});
