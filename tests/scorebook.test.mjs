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
  assert.equal(data.project.version, '0.5.1');
});

test('instrument has the expected 16-note range', async () => {
  const { data } = await loadScorebook();
  assert.deepEqual(data.instrument.keys, [
    '4_', '5_', '6_', '7_', '1', '2', '3', '4',
    '5', '6', '7', '1^', '2^', '3^', '4^', '5^',
  ]);
});

test('staff renderer and browser visual runner are version pinned', async () => {
  const { data } = await loadScorebook();
  assert.deepEqual(data.rendering.staff, {
    engine: 'vexflow',
    version: '5.0.0',
    delivery: 'local_build_artifact',
    license: 'MIT',
    output: 'SVG',
    hand_drawn_staff: 'forbidden',
  });
  assert.deepEqual(data.gates.visual.runner, {
    engine: 'playwright',
    version: '1.55.0',
    browser: 'chromium',
    viewport: {
      width_px: 1440,
      height_px: 1800,
      device_scale_factor: 1,
    },
    wait_for_selector: '.status--pass',
    target_song_id: 'itsy-bitsy-spider',
  });

  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(packageJson.version, '0.5.1');
  assert.equal(packageJson.dependencies.vexflow, '5.0.0');
  assert.match(packageJson.scripts.visual, /@playwright\/test@1\.55\.0/);
  assert.equal(packageJson.scripts['check:visual'], 'npm run check && npm run visual');
});

test('layout uses smaller numbers, larger lyrics, and a wider staff gap', async () => {
  const { data } = await loadScorebook();
  const system = data.layout.notation_system;
  assert.equal(data.layout.profile, 'a4_japanese_textbook');
  assert.deepEqual(data.layout.page, {
    size: 'A4',
    orientation: 'portrait',
    width_mm: 210,
    height_mm: 297,
    margin_mm: 12,
    fixed_aspect_ratio: true,
  });
  assert.equal(system.colored_note_numbers_primary, true);
  assert.equal(system.note_boxes, 'forbidden');
  assert.equal(system.staff_secondary, true);
  assert.deepEqual(system.numbered_notation, {
    number_style: 'unboxed',
    duration_extension_marks: 'forbidden',
    note_row_height_px: 82,
    lyric_top_px: 58,
    staff_pull_up_px: 8,
    min_lyric_to_staff_content_gap_px: 12,
    max_lyric_to_staff_content_gap_px: 16,
  });
  assert.deepEqual(system.alignment, {
    source: 'vexflow_notehead_bounds_center_x',
    targets: ['colored_note_number', 'lyric'],
    tolerance_px: 1,
  });
  assert.deepEqual(data.gates.visual.measurements, {
    lyric_to_staff_top_line_gap_px: {
      min: 12,
      max: 16,
    },
    number_center_to_notehead_center_error_px: {
      max: 1,
    },
    lyric_font_size_px: 18,
    note_number_font_size_px: 26,
  });
});

test('visual gate requires exact-SHA screenshots and metrics artifacts', async () => {
  const { data } = await loadScorebook();
  assert.deepEqual(data.gates.visual.screenshots, [
    {
      id: 'itsy-bitsy-spider-a4',
      selector: ".song-page[data-song-id='itsy-bitsy-spider']",
      filename: 'itsy-bitsy-spider-a4.png',
    },
    {
      id: 'itsy-bitsy-spider-first-system',
      selector: ".song-page[data-song-id='itsy-bitsy-spider'] .phrase-system:first-of-type",
      filename: 'itsy-bitsy-spider-first-system.png',
    },
  ]);
  assert.deepEqual(data.gates.visual.artifacts, {
    directory: 'reports/visual',
    retention_days: 14,
    exact_head_sha_in_artifact_name: true,
  });
  assert.ok(data.workflow.includes('run_browser_visual_gate'));
  assert.ok(data.workflow.includes('capture_visual_gate_screenshots'));
  assert.ok(data.workflow.includes('upload_visual_gate_artifacts'));
});

test('unboxed numbered notes retain approved octave dot clearances', async () => {
  const { data } = await loadScorebook();
  assert.equal('note_box' in data.notation, false);
  assert.deepEqual(data.notation.numbered_note, {
    width_px: 28,
    stack_height_px: 52,
    border: 'none',
    background: 'none',
  });
  assert.deepEqual(data.notation.octave_dot, {
    shape: 'circle',
    diameter_px: 10,
    min_number_clearance_px: 3,
  });
  assert.deepEqual(data.notation.typography, {
    note_number_px: 26,
    lyric_px: 18,
  });
  assert.deepEqual(data.notation.upper_dot, {
    location: 'above_number',
    alignment: 'centered',
    color: 'inherit',
  });
  assert.deepEqual(data.notation.lower_dot, {
    location: 'below_number',
    alignment: 'centered',
    color: 'inherit',
  });

  const note = data.notation.numbered_note;
  const dot = data.notation.octave_dot;
  const requiredHeight = dot.diameter_px * 2
    + dot.min_number_clearance_px * 2
    + data.notation.typography.note_number_px;
  assert.equal(note.stack_height_px, requiredHeight);
});

test('major keys, meters, and numbered pitches map deterministically', () => {
  assert.deepEqual(parseMajorKey('C major'), { tonicLetter: 'c', keySignature: 'C' });
  assert.deepEqual(parseMajorKey('G major'), { tonicLetter: 'g', keySignature: 'G' });
  assert.deepEqual(parseMajorKey('D major'), { tonicLetter: 'd', keySignature: 'D' });
  assert.deepEqual(parseMeter('6/8'), { numerator: 6, denominator: 8 });
  assert.equal(pitchToVexKey('1', 'C major'), 'c/4');
  assert.equal(pitchToVexKey('1^', 'C major'), 'c/5');
  assert.equal(pitchToVexKey('7_', 'C major'), 'b/3');
  assert.equal(pitchToVexKey('1', 'G major'), 'g/4');
  assert.equal(pitchToVexKey('7_', 'G major'), 'f/4');
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
  assert.deepEqual(model.ties, [{ fromSegmentIndex: 0, toSegmentIndex: 1, eventIndex: 0 }]);
});

test('every real system preserves events and produces one staff anchor per event', async () => {
  const { data } = await loadScorebook();
  const limit = data.layout.notation_system.max_events_per_system;
  for (const song of data.songs) {
    for (const phrase of song.phrases) {
      const systems = splitEvents(phrase.events, limit);
      assert.deepEqual(systems.flat(), phrase.events, `${song.title} event order changed`);
      for (const events of systems) {
        const model = createStaffModel(events, song);
        assert.equal(model.anchorSegmentIndexes.length, events.length);
        assert.equal(model.totalEighthUnits, events.reduce((sum, event) => sum + event.duration, 0));
      }
    }
  }
});

test('generated CSS and source enforce typography and notehead-centered geometry', async () => {
  const [
    designCss,
    styles,
    appSource,
    staffRendererSource,
    visualSpecSource,
    agentsSource,
  ] = await Promise.all([
    readFile('dist/design.css', 'utf8'),
    readFile('src/styles.css', 'utf8'),
    readFile('src/app.js', 'utf8'),
    readFile('src/staff-renderer.js', 'utf8'),
    readFile('tests/visual.spec.mjs', 'utf8'),
    readFile('AGENTS.md', 'utf8'),
  ]);

  assert.match(designCss, /--numbered-note-row-height: 82px;/);
  assert.match(designCss, /--numbered-lyric-top: 58px;/);
  assert.match(designCss, /--staff-pull-up: 8px;/);
  assert.match(designCss, /--min-lyric-staff-gap: 12px;/);
  assert.match(designCss, /--max-lyric-staff-gap: 16px;/);
  assert.match(designCss, /--numbered-note-width: 28px;/);
  assert.match(designCss, /--numbered-note-stack-height: 52px;/);
  assert.match(designCss, /--note-number-size: 26px;/);
  assert.match(designCss, /--lyric-size: 18px;/);
  assert.doesNotMatch(designCss, /note-box|border-clearance|extension/i);

  assert.match(styles, /\.numbered-note\s*\{/);
  assert.match(styles, /font-size:\s*var\(--note-number-size, 26px\)/);
  assert.match(styles, /font-size:\s*var\(--lyric-size, 18px\)/);
  assert.match(styles, /border:\s*0;/);
  assert.match(styles, /background:\s*transparent;/);
  assert.match(styles, /margin:\s*calc\(-1 \* var\(--staff-pull-up, 8px\)\) 0 0/);
  assert.doesNotMatch(styles, /\.note-box|--note-box|\.extensions|overflow-x:\s*auto/);

  assert.match(appSource, /createNumberedNote/);
  assert.match(appSource, /notation\.numbered_note\.width_px/);
  assert.match(appSource, /querySelector\('\.numbered-note'\)/);
  assert.doesNotMatch(appSource, /createNoteBox|note-box|notation\.note_box|extensions|延長|—/);

  assert.match(staffRendererSource, /getNoteHeadBeginX\(\)/);
  assert.match(staffRendererSource, /getNoteHeadEndX\(\)/);
  assert.match(staffRendererSource, /vexflow-notehead-bounds-center/);
  assert.doesNotMatch(staffRendererSource, /model\.anchorSegmentIndexes\.map\([^]*getAbsoluteX\(\)/);

  assert.match(visualSpecSource, /lyricFontSize/);
  assert.match(visualSpecSource, /noteNumberFontSize/);
  assert.match(visualSpecSource, /expectedLyricFontSize/);
  assert.match(visualSpecSource, /expectedNoteNumberFontSize/);
  assert.match(visualSpecSource, /numberCenterErrors/);
  assert.match(visualSpecSource, /lyricCenterErrors/);
  assert.match(visualSpecSource, /noteBoxCount/);
  assert.match(visualSpecSource, /visual-gate-report\.json/);
  assert.match(agentsSource, /無框彩色數字/);
  assert.doesNotMatch(agentsSource, /彩色框內/);
});

test('CI and Pages require Chromium screenshots and upload exact-SHA artifacts', async () => {
  const [ci, pages] = await Promise.all([
    readFile('.github/workflows/ci.yml', 'utf8'),
    readFile('.github/workflows/pages.yml', 'utf8'),
  ]);
  for (const workflow of [ci, pages]) {
    assert.match(workflow, /playwright@1\.55\.0 install --with-deps chromium/);
    assert.match(workflow, /npm run check:visual/);
    assert.match(workflow, /\$\{\{ github\.sha \}\}/);
    assert.match(workflow, /retention-days:\s*14/);
  }
});

test('all required gates include typography and measured-alignment checks', async () => {
  const { data } = await loadScorebook();
  for (const gate of ['content', 'html', 'visual', 'print', 'release']) {
    assert.equal(data.gates[gate].required, true, `${gate} gate must be required`);
  }
  assert.ok(data.gates.html.checks.includes('no_note_box_markup'));
  assert.ok(data.gates.html.checks.includes('no_note_box_border_or_background'));
  assert.ok(data.gates.html.checks.includes('shared_vexflow_notehead_center_used_by_number_and_lyric'));
  assert.ok(data.gates.html.checks.includes('typography_generated_from_scorebook'));
  assert.ok(data.gates.visual.checks.includes('note_boxes_are_absent'));
  assert.ok(data.gates.visual.checks.includes('actual_number_to_notehead_center_error_within_spec'));
  assert.ok(data.gates.visual.checks.includes('actual_lyric_to_staff_top_line_gap_within_spec'));
  assert.ok(data.gates.visual.checks.includes('actual_lyric_font_size_matches_spec'));
  assert.ok(data.gates.visual.checks.includes('actual_note_number_font_size_matches_spec'));
  assert.ok(data.gates.print.checks.includes('no_note_box_in_print'));
  assert.ok(data.gates.print.checks.includes('typography_size_survives_print'));
});

test('every event pitch remains parseable and playable', async () => {
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
