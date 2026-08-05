import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadScorebook, parsePitch, validateScorebook } from '../scripts/lib.mjs';
import { splitEvents } from '../src/layout.js';
import {
  createStaffModel,
  decomposeDuration,
  parseMajorKey,
  parseMeter,
  pitchToVexKey,
} from '../src/staff-model.js';

test('scorebook passes content and design gate', async () => {
  const { data } = await loadScorebook();
  const result = validateScorebook(data);
  assert.equal(result.pass, true, JSON.stringify(result.errors, null, 2));
  assert.equal(data.project.version, '0.3.1');
});

test('instrument has the expected 16-note range', async () => {
  const { data } = await loadScorebook();
  assert.deepEqual(data.instrument.keys, [
    '4_', '5_', '6_', '7_', '1', '2', '3', '4',
    '5', '6', '7', '1^', '2^', '3^', '4^', '5^',
  ]);
});

test('staff renderer is pinned to local VexFlow 5.0.0', async () => {
  const { data } = await loadScorebook();
  assert.deepEqual(data.rendering.staff, {
    engine: 'vexflow',
    version: '5.0.0',
    delivery: 'local_build_artifact',
    license: 'MIT',
    output: 'SVG',
    hand_drawn_staff: 'forbidden',
  });

  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(packageJson.version, '0.3.1');
  assert.equal(packageJson.dependencies.vexflow, '5.0.0');
  assert.equal(packageJson.dependencies.yaml, '2.8.1');
});

test('layout uses the approved A4 textbook profile and compact numbered notation', async () => {
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
  assert.deepEqual(data.layout.notation_system.numbered_notation, {
    duration_extension_marks: 'forbidden',
    note_row_height_px: 92,
    lyric_top_px: 70,
    staff_pull_up_px: 8,
    min_lyric_to_staff_content_gap_px: 8,
  });
  assert.deepEqual(data.layout.notation_system.alignment, {
    source: 'vexflow_first_notehead_absolute_x',
    targets: ['colored_note_box', 'lyric'],
    tolerance_px: 1,
  });
  assert.deepEqual(data.layout.notation_system.staff, {
    width_px: 700,
    height_px: 118,
    stave_y_px: 18,
    clef: 'treble',
    key_signature: 'from_song_key',
    time_signature: 'first_system_only',
    beam_eighth_notes: true,
    composite_duration: 'split_and_tie',
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
  assert.deepEqual(data.notation.typography, {
    note_number_px: 27,
    lyric_px: 15,
  });
  assert.equal('extension_color' in data.notation, false);

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

test('major keys and meters are parsed deterministically', () => {
  assert.deepEqual(parseMajorKey('C major'), { tonicLetter: 'c', keySignature: 'C' });
  assert.deepEqual(parseMajorKey('G major'), { tonicLetter: 'g', keySignature: 'G' });
  assert.deepEqual(parseMajorKey('D major'), { tonicLetter: 'd', keySignature: 'D' });
  assert.deepEqual(parseMeter('6/8'), { numerator: 6, denominator: 8 });
  assert.throws(() => parseMajorKey('minor'), /不支援的調性/);
  assert.throws(() => parseMeter('6'), /不支援的拍號/);
});

test('numbered pitches map to key-aware staff positions', () => {
  assert.equal(pitchToVexKey('1', 'C major'), 'c/4');
  assert.equal(pitchToVexKey('1^', 'C major'), 'c/5');
  assert.equal(pitchToVexKey('7_', 'C major'), 'b/3');

  assert.equal(pitchToVexKey('1', 'G major'), 'g/4');
  assert.equal(pitchToVexKey('7', 'G major'), 'f/5');
  assert.equal(pitchToVexKey('7_', 'G major'), 'f/4');

  assert.equal(pitchToVexKey('1', 'D major'), 'd/4');
  assert.equal(pitchToVexKey('3', 'D major'), 'f/4');
  assert.equal(pitchToVexKey('1^', 'D major'), 'd/5');
});

test('durations map to standard VexFlow values and composite ties', () => {
  assert.deepEqual(decomposeDuration(1), [{ eighthUnits: 1, vexDuration: '8', dots: 0 }]);
  assert.deepEqual(decomposeDuration(3), [{ eighthUnits: 3, vexDuration: 'qd', dots: 1 }]);
  assert.deepEqual(decomposeDuration(6), [{ eighthUnits: 6, vexDuration: 'hd', dots: 1 }]);
  assert.deepEqual(decomposeDuration(5), [
    { eighthUnits: 4, vexDuration: 'h', dots: 0 },
    { eighthUnits: 1, vexDuration: '8', dots: 0 },
  ]);

  const model = createStaffModel([
    { pitch: '1', duration: 5, lyric: '管' },
    { pitch: '2', duration: 1, lyric: '上' },
  ], { key: 'G major', meter: '6/8' });
  assert.equal(model.totalEighthUnits, 6);
  assert.deepEqual(model.anchorSegmentIndexes, [0, 2]);
  assert.equal(model.segments.length, 3);
  assert.deepEqual(model.ties, [{ fromSegmentIndex: 0, toSegmentIndex: 1, eventIndex: 0 }]);
});

test('every real system produces one staff anchor per event without data loss', async () => {
  const { data } = await loadScorebook();
  const limit = data.layout.notation_system.max_events_per_system;
  for (const song of data.songs) {
    for (const phrase of song.phrases) {
      const systems = splitEvents(phrase.events, limit);
      assert.deepEqual(systems.flat(), phrase.events, `${song.title} event order changed`);
      assert.ok(systems.every((system) => system.length <= limit), `${song.title} system too long`);
      for (const events of systems) {
        const model = createStaffModel(events, song);
        assert.equal(model.anchorSegmentIndexes.length, events.length, `${song.title} anchor count changed`);
        assert.equal(
          model.totalEighthUnits,
          events.reduce((sum, event) => sum + event.duration, 0),
          `${song.title} duration changed`,
        );
      }
    }
  }
});

test('system splitter preserves every event in order and enforces the limit', () => {
  const events = Array.from({ length: 29 }, (_, index) => ({ pitch: String((index % 7) + 1), index }));
  const systems = splitEvents(events, 13);
  assert.deepEqual(systems.map((system) => system.length), [13, 13, 3]);
  assert.deepEqual(systems.flat(), events);
  assert.ok(systems.every((system) => system.length <= 13));
});

test('generated staff, spacing, and alignment contract comes from scorebook', async () => {
  const { data } = await loadScorebook();
  const [
    designCss,
    styles,
    appSource,
    staffRendererSource,
    buildSource,
    html,
    vexflowBundle,
  ] = await Promise.all([
    readFile('dist/design.css', 'utf8'),
    readFile('src/styles.css', 'utf8'),
    readFile('src/app.js', 'utf8'),
    readFile('src/staff-renderer.js', 'utf8'),
    readFile('scripts/build.mjs', 'utf8'),
    readFile('dist/index.html', 'utf8'),
    readFile('dist/vendor/vexflow.js', 'utf8'),
  ]);

  assert.match(designCss, /--page-width: 210mm;/);
  assert.match(designCss, /--page-height: 297mm;/);
  assert.match(designCss, /--numbered-note-row-height: 92px;/);
  assert.match(designCss, /--numbered-lyric-top: 70px;/);
  assert.match(designCss, /--staff-pull-up: 8px;/);
  assert.match(designCss, /--min-lyric-staff-gap: 8px;/);
  assert.match(designCss, /--staff-width: 700px;/);
  assert.match(designCss, /--staff-height: 118px;/);
  assert.match(designCss, /--staff-alignment-tolerance: 1px;/);
  assert.match(designCss, new RegExp(`--note-box-width: ${data.notation.note_box.width_px}px;`));
  assert.match(designCss, new RegExp(`--octave-dot-diameter: ${data.notation.octave_dot.diameter_px}px;`));
  assert.doesNotMatch(designCss, /extension/i);

  const vendorIndex = html.indexOf('<script src="./vendor/vexflow.js"></script>');
  const appIndex = html.indexOf('<script type="module" src="./app.js"></script>');
  assert.ok(vendorIndex >= 0 && appIndex > vendorIndex, 'local VexFlow must load before app.js');
  assert.match(vexflowBundle.slice(0, 200), /VexFlow 5\.0\.0/);
  assert.match(buildSource, /node_modules\/vexflow\/build\/cjs\/vexflow\.js/);
  assert.match(buildSource, /dist\/vendor\/vexflow\.js/);

  assert.match(staffRendererSource, /new Renderer\(container, Renderer\.Backends\.SVG\)/);
  assert.match(staffRendererSource, /new Formatter\(\)/);
  assert.match(staffRendererSource, /getAbsoluteX\(\)/);
  assert.match(staffRendererSource, /Dot\.buildAndAttach/);
  assert.match(staffRendererSource, /Beam\.applyAndGetBeams/);
  assert.match(staffRendererSource, /new StaveTie/);
  assert.doesNotMatch(staffRendererSource, /createElementNS|<line|<ellipse/);

  assert.match(appSource, /const \{ anchors \} = renderStaffSystem/);
  assert.match(appSource, /cell\.style\.left = `\$\{anchorX\}px`/);
  assert.match(appSource, /lyric\.dataset\.staffAnchorX = anchorX\.toFixed\(3\)/);
  assert.match(appSource, /assertSharedAnchors/);
  assert.doesNotMatch(appSource, /extensions|延長|—/);
  assert.doesNotMatch(appSource, /createElementNS|grid-template-columns/);

  assert.match(styles, /height:\s*var\(--numbered-note-row-height, 92px\)/);
  assert.match(styles, /top:\s*var\(--numbered-lyric-top, 70px\)/);
  assert.match(styles, /margin:\s*calc\(-1 \* var\(--staff-pull-up, 8px\)\) 0 0/);
  assert.match(styles, /\.note-row\s*\{[^}]*position:\s*relative/s);
  assert.match(styles, /\.event\s*\{[^}]*position:\s*absolute/s);
  assert.match(styles, /transform:\s*translateX\(-50%\)/);
  assert.doesNotMatch(styles, /\.extensions|overflow-x:\s*auto/);
  assert.doesNotMatch(styles, /\.staff-line|\.staff-note|\.staff-clef/);
});

test('all required gates include underline removal and compact spacing checks', async () => {
  const { data } = await loadScorebook();
  for (const gate of ['content', 'html', 'visual', 'print', 'release']) {
    assert.equal(data.gates[gate].required, true, `${gate} gate must be required`);
  }
  assert.ok(data.gates.content.checks.includes('duration_mappable_to_vexflow'));
  assert.ok(data.gates.html.checks.includes('vexflow_bundle_is_local_and_version_pinned'));
  assert.ok(data.gates.html.checks.includes('no_hand_drawn_staff_svg'));
  assert.ok(data.gates.html.checks.includes('shared_vexflow_anchor_used_by_note_box_and_lyric'));
  assert.ok(data.gates.html.checks.includes('no_numbered_duration_extension_marks'));
  assert.ok(data.gates.html.checks.includes('numbered_notation_spacing_generated_from_scorebook'));
  assert.ok(data.gates.visual.checks.includes('numbered_notation_group_is_close_to_staff'));
  assert.ok(data.gates.visual.checks.includes('lyric_does_not_touch_staff_content'));
  assert.ok(data.gates.print.checks.includes('no_numbered_duration_underline'));
  assert.ok(data.gates.print.checks.includes('compact_notation_staff_spacing_survives_print'));
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
