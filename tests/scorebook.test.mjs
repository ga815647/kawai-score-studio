import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadScorebook, parsePitch, validateScorebook } from '../scripts/lib.mjs';
import { splitEvents } from '../src/layout.js';

test('scorebook passes content and design gate', async () => {
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

test('layout uses the approved A4 Japanese textbook profile', async () => {
  const { data } = await loadScorebook();
  assert.equal(data.layout.profile, 'a4_japanese_textbook');
  assert.deepEqual(data.layout.page, {
    size: 'A4',
    orientation: 'portrait',
    width_mm: 210,
    height_mm: 297,
    margin_mm: 12,
    fixed_aspect_ratio: true,
  });
  assert.deepEqual(data.layout.title, {
    style: 'rounded_textbook_label',
    alignment: 'left',
    max_width_percent: 72,
  });
  assert.deepEqual(data.layout.notation_system, {
    colored_note_boxes_primary: true,
    staff_secondary: true,
    max_events_per_system: 13,
    horizontal_overflow: 'forbidden',
    note_row_border: 'none',
    system_gap_px: 12,
  });
  assert.deepEqual(data.layout.illustration, {
    mode: 'optional_later',
    carries_text: false,
    carries_notation: false,
    reserved_area: 'none',
    piano_keyboard: 'forbidden',
  });
});

test('compact note boxes retain the approved octave dot clearances', async () => {
  const { data } = await loadScorebook();
  assert.deepEqual(data.notation.note_box, {
    width_px: 44,
    height_px: 68,
    border_width_px: 3,
    border_radius_px: 12,
    vertical_padding_px: 5,
  });
  assert.deepEqual(data.notation.octave_dot, {
    shape: 'circle',
    diameter_px: 10,
    min_border_clearance_px: 8,
    min_number_clearance_px: 4,
  });

  const box = data.notation.note_box;
  const dot = data.notation.octave_dot;
  const borderClearance = box.border_width_px + box.vertical_padding_px;
  const innerHeight = box.height_px - box.border_width_px * 2 - box.vertical_padding_px * 2;
  const numberRowHeight = innerHeight - dot.diameter_px * 2 - dot.min_number_clearance_px * 2;

  assert.equal(dot.diameter_px, 10, 'approved dot size must not regress');
  assert.ok(borderClearance >= dot.min_border_clearance_px);
  assert.ok(dot.min_number_clearance_px >= 4);
  assert.ok(numberRowHeight > 0, 'number row must remain separate from both dots');
});

test('system splitter preserves every event in order and enforces the limit', () => {
  const events = Array.from({ length: 29 }, (_, index) => ({ pitch: String((index % 7) + 1), index }));
  const systems = splitEvents(events, 13);
  assert.deepEqual(systems.map((system) => system.length), [13, 13, 3]);
  assert.deepEqual(systems.flat(), events);
  assert.ok(systems.every((system) => system.length <= 13));
});

test('every real phrase can be split without loss', async () => {
  const { data } = await loadScorebook();
  const limit = data.layout.notation_system.max_events_per_system;
  for (const song of data.songs) {
    for (const phrase of song.phrases) {
      const systems = splitEvents(phrase.events, limit);
      assert.deepEqual(systems.flat(), phrase.events, `${song.title} event order changed`);
      assert.ok(systems.every((system) => system.length <= limit), `${song.title} system too long`);
    }
  }
});

test('generated design contract comes from scorebook', async () => {
  const { data } = await loadScorebook();
  const [designCss, styles, appSource, layoutSource, html] = await Promise.all([
    readFile('dist/design.css', 'utf8'),
    readFile('src/styles.css', 'utf8'),
    readFile('src/app.js', 'utf8'),
    readFile('dist/layout.js', 'utf8'),
    readFile('dist/index.html', 'utf8'),
  ]);

  assert.match(designCss, /--page-width: 210mm;/);
  assert.match(designCss, /--page-height: 297mm;/);
  assert.match(designCss, /--page-margin: 12mm;/);
  assert.match(designCss, /--max-events-per-system: 13;/);
  assert.match(designCss, new RegExp(`--note-box-width: ${data.notation.note_box.width_px}px;`));
  assert.match(designCss, new RegExp(`--note-box-height: ${data.notation.note_box.height_px}px;`));
  assert.match(designCss, new RegExp(`--octave-dot-diameter: ${data.notation.octave_dot.diameter_px}px;`));
  assert.match(html, /href="\.\/design\.css"/);
  assert.match(styles, /width:\s*var\(--page-width, 210mm\)/);
  assert.match(styles, /height:\s*var\(--page-height, 297mm\)/);
  assert.match(styles, /grid-template-columns:\s*repeat\(var\(--event-count\), minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.song-title-card/);
  assert.match(styles, /\.page-viewport/);
  assert.doesNotMatch(styles, /overflow-x:\s*auto/);
  assert.match(appSource, /splitEvents\(phrase\.events, layout\.notation_system\.max_events_per_system\)/);
  assert.match(appSource, /page\.style\.transform = `scale\(\$\{scale\}\)`/);
  assert.match(layoutSource, /events\.slice\(index, index \+ maxEventsPerSystem\)/);
  assert.doesNotMatch(appSource, /●/);
  assert.doesNotMatch(appSource, /piano|keyboard/i);
});

test('all required gates include A4, overflow, and illustration checks', async () => {
  const { data } = await loadScorebook();
  for (const gate of ['content', 'html', 'visual', 'print', 'release']) {
    assert.equal(data.gates[gate].required, true, `${gate} gate must be required`);
  }
  assert.ok(data.gates.html.checks.includes('phrase_events_split_without_loss'));
  assert.ok(data.gates.visual.checks.includes('a4_aspect_ratio_preserved'));
  assert.ok(data.gates.visual.checks.includes('no_horizontal_scroll'));
  assert.ok(data.gates.visual.checks.includes('no_piano_keyboard'));
  assert.ok(data.gates.print.checks.includes('exact_page_dimensions'));
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
