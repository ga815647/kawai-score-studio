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
  assert.equal(data.project.version, '0.4.0');
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
  assert.equal(packageJson.version, '0.4.0');
  assert.equal(packageJson.dependencies.vexflow, '5.0.0');
  assert.match(packageJson.scripts.visual, /@playwright\/test@1\.55\.0/);
  assert.equal(packageJson.scripts['check:visual'], 'npm run check && npm run visual');
});

test('layout uses approved compact numbered notation spacing', async () => {
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
  assert.deepEqual(data.layout.notation_system.numbered_notation, {
    duration_extension_marks: 'forbidden',
    note_row_height_px: 92,
    lyric_top_px: 70,
    staff_pull_up_px: 16,
    min_lyric_to_staff_content_gap_px: 3,
    max_lyric_to_staff_content_gap_px: 6,
  });
  assert.deepEqual(data.gates.visual.measurements, {
    lyric_to_staff_top_line_gap_px: {
      min: 3,
      max: 6,
    },
  });
  assert.deepEqual(data.layout.notation_system.alignment, {
    source: 'vexflow_first_notehead_absolute_x',
    targets: ['colored_note_box', 'lyric'],
    tolerance_px: 1,
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

test('compact note boxes retain approved octave dot clearances', async () => {
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
  assert.ok(borderClearance >= dot.min_border_clearance_px);
  assert.ok(numberRowHeight > 0);
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

test('generated CSS and source expose browser-measurable geometry', async () => {
  const [
    designCss,
    styles,
    appSource,
    staffRendererSource,
    visualSpecSource,
    playwrightConfig,
  ] = await Promise.all([
    readFile('dist/design.css', 'utf8'),
    readFile('src/styles.css', 'utf8'),
    readFile('src/app.js', 'utf8'),
    readFile('src/staff-renderer.js', 'utf8'),
    readFile('tests/visual.spec.mjs', 'utf8'),
    readFile('playwright.config.mjs', 'utf8'),
  ]);

  assert.match(designCss, /--numbered-note-row-height: 92px;/);
  assert.match(designCss, /--numbered-lyric-top: 70px;/);
  assert.match(designCss, /--staff-pull-up: 16px;/);
  assert.match(designCss, /--min-lyric-staff-gap: 3px;/);
  assert.match(designCss, /--max-lyric-staff-gap: 6px;/);
  assert.doesNotMatch(designCss, /extension/i);

  assert.match(styles, /margin:\s*calc\(-1 \* var\(--staff-pull-up, 8px\)\) 0 0/);
  assert.doesNotMatch(styles, /\.extensions|overflow-x:\s*auto/);
  assert.match(appSource, /cell\.style\.left = `\$\{anchorX\}px`/);
  assert.doesNotMatch(appSource, /extensions|延長|—/);

  assert.match(staffRendererSource, /spaceAboveStaffLn:\s*0/);
  assert.match(staffRendererSource, /dataset\.staffTopLineY/);
  assert.match(staffRendererSource, /getYForLine\(0\)/);
  assert.match(staffRendererSource, /getAbsoluteX\(\)/);

  assert.match(visualSpecSource, /staffTopLineY/);
  assert.match(visualSpecSource, /lyric_to_staff_top_line_gap_px/);
  assert.match(visualSpecSource, /visual-gate-report\.json/);
  assert.match(visualSpecSource, /\.screenshot\(/);
  assert.match(playwrightConfig, /browserName:\s*'chromium'/);
  assert.match(playwrightConfig, /width:\s*1440/);
  assert.match(playwrightConfig, /height:\s*1800/);
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

test('all required gates include screenshot and measured-spacing checks', async () => {
  const { data } = await loadScorebook();
  for (const gate of ['content', 'html', 'visual', 'print', 'release']) {
    assert.equal(data.gates[gate].required, true, `${gate} gate must be required`);
  }
  assert.ok(data.gates.visual.checks.includes('browser_page_reaches_gate_pass_state'));
  assert.ok(data.gates.visual.checks.includes('actual_lyric_to_staff_top_line_gap_within_spec'));
  assert.ok(data.gates.visual.checks.includes('required_a4_and_closeup_screenshots_created'));
  assert.ok(data.gates.visual.checks.includes('screenshot_metrics_report_created'));
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
