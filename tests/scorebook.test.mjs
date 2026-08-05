import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  flattenEvents,
  loadFixtures,
  loadScorebook,
  parseMeter,
  validateProject,
} from '../scripts/lib.mjs';
import {
  createRenderModel,
  decomposeDuration,
  flattenMeasures,
  pitchToFrequency,
  pitchToVexKey,
} from '../src/score-engine.js';
import { splitMeasuresByRequiredWidth } from '../src/staff-renderer.js';

async function loadProject() {
  const [{ data: book }, { data: fixtures }] = await Promise.all([
    loadScorebook(),
    loadFixtures(),
  ]);
  return { book, fixtures };
}

function clone(value) {
  return structuredClone(value);
}

test('formal specification and synthetic fixtures pass all structural gates', async () => {
  const { book, fixtures } = await loadProject();
  const result = validateProject(book, fixtures);
  assert.equal(result.pass, true, JSON.stringify(result.errors, null, 2));
  assert.equal(book.project.version, '0.6.6');
  assert.deepEqual(result.counts, {
    verifiedSongs: 0,
    quarantinedEntries: 3,
    fixtures: 1,
  });
});

test('public library remains empty until exact-source verification', async () => {
  const { book } = await loadProject();
  assert.deepEqual(book.library.songs, []);
  assert.deepEqual(book.modes.library.accepts_status, ['verified']);
  assert.ok(book.modes.library.publication_requires.includes('exact_source'));
  assert.ok(book.modes.library.publication_requires.includes('user_approval'));
  assert.ok(book.modes.library.publication_requires.includes('exact_head_sha_ci'));
});

test('legacy songs remain metadata-only quarantine entries', async () => {
  const { book } = await loadProject();
  assert.deepEqual(book.library.quarantine.map((item) => item.id), [
    'happy-birthday',
    'itsy-bitsy-spider',
    'hickory-dickory-dock',
  ]);
  for (const entry of book.library.quarantine) {
    for (const forbidden of ['measures', 'events', 'phrases', 'lyric_tracks']) {
      assert.equal(forbidden in entry, false, `${entry.id} leaked ${forbidden}`);
    }
  }
});

test('Studio preview and playback do not require GitHub or Actions', async () => {
  const { book } = await loadProject();
  assert.equal(book.modes.studio.github_required, false);
  assert.equal(book.modes.studio.github_actions_required, false);
  assert.equal(book.modes.studio.local_storage, true);
  assert.equal(book.rendering.playback.engine, 'web_audio');
  assert.equal(book.rendering.playback.runs_in_browser, true);
});

test('layout keeps song-standard rows with per-label VexFlow pointer-rectangle exceptions', async () => {
  const { book } = await loadProject();
  assert.deepEqual(book.layout.vertical_order, ['numbered_notation', 'staff', 'lyrics']);
  assert.equal(book.notation.numbered_notation.position, 'above_staff');
  assert.equal(book.notation.staff.position, 'middle');
  assert.equal(book.notation.lyrics.position, 'below_staff');
  assert.equal(book.notation.lyrics.renderer, 'html_overlay');
  assert.equal(book.notation.lyrics.vertical_alignment, 'shared_baseline');
  assert.equal(book.notation.lyrics.collision_exception, 'per_event_vexflow_stavenote_pointer_rect');
  assert.deepEqual(book.layout.system_geometry, {
    staff_width_px: 700,
    staff_canvas_height_px: 170,
    stave_top_line_y_px: 18,
    numbered_row_height_px: 50,
    numbered_note_height_px: 52,
    numbered_to_staff_top_line_gap_px: 16,
    lyric_row: {
      staff_bottom_line_to_top_px: 12,
      line_height_px: 22,
      max_vertical_alignment_delta_px: 1,
      default_baseline_shared_across_song: true,
    },
    collision_adjustment: {
      scope: 'per_event',
      trigger: 'vexflow_stavenote_pointer_rect',
      standard_label_geometry_source: 'scorebook_system_geometry',
      numbered_notation_direction: 'up_only',
      lyric_direction: 'down_only',
      glyph_clearance_px: 6,
      maximum_shift_px: 32,
      uncollided_event_shift_px: 0,
    },
  });
  assert.deepEqual(book.gates.visual.measurements, {
    minimum_system_count: 2,
    numbered_to_staff_top_line_gap_px: { min: 14, max: 18 },
    staff_bottom_line_to_lyric_top_px: { min: 10, max: 14 },
    lyric_vertical_alignment_delta_px: { max: 1 },
    adjusted_glyph_clearance_px: { min: 6 },
    default_row_delta_across_systems_px: { max: 1 },
    maximum_individual_shift_px: { max: 32 },
    minimum_adjusted_labels_per_extreme_event: 1,
  });
});

test('fixture covers at least two systems and both instrument extremes', async () => {
  const { book, fixtures } = await loadProject();
  const fixture = fixtures.fixtures[0];
  const events = flattenEvents(fixture);
  assert.equal(fixture.synthetic, true);
  assert.equal(fixture.pickup_eighth_units, 1);
  assert.deepEqual(fixture.measures.map((measure) => measure.capacity_eighth_units), [1, 6, 6, 6]);
  assert.ok(events.some((event) => event.kind === 'rest'));
  assert.ok(events.some((event) => event.pitch === book.instrument.lowest_note));
  assert.ok(events.some((event) => event.pitch === book.instrument.highest_note));
  assert.deepEqual(fixture.ties, [{ id: 't01', from: 'n05', to: 'n06' }]);
  const track = fixture.lyric_tracks.find((candidate) => candidate.default);
  assert.equal(track.locale, 'en');
  assert.equal(track.role, 'original');
  assert.ok(track.syllables.some((syllable) => syllable.text === 'extraordinary'));
  assert.deepEqual(
    splitMeasuresByRequiredWidth(fixture, track, 700).map((system) => system.length),
    [2, 2],
  );
  assert.equal(book.fixtures.minimum_rendered_systems, 2);
  assert.equal(book.fixtures.must_cover_instrument_lowest_note, true);
  assert.equal(book.fixtures.must_cover_instrument_highest_note, true);
  for (const event of events) {
    assert.equal('lyric' in event, false);
    assert.equal('text' in event, false);
  }
});

test('measure capacities are derived in eighth-note units', () => {
  assert.deepEqual(parseMeter('6/8'), { numerator: 6, denominator: 8, capacityEighthUnits: 6 });
  assert.deepEqual(parseMeter('3/4'), { numerator: 3, denominator: 4, capacityEighthUnits: 6 });
  assert.equal(parseMeter('5/16'), null, 'fractional eighth-unit measures are not yet supported');
});

test('event engine produces staff, lyric, tie, rest, and playback data from one melody source', async () => {
  const { fixtures } = await loadProject();
  const fixture = fixtures.fixtures[0];
  const model = createRenderModel(fixture);
  assert.deepEqual(model.events, flattenMeasures(fixture));
  assert.ok(model.segments.some((segment) => segment.eventKind === 'rest'));
  assert.ok(model.segments.some((segment) => segment.lyric === 'extraordinary'));
  assert.ok(model.segments.some((segment) => segment.pitch === '4_'));
  assert.ok(model.segments.some((segment) => segment.pitch === '5^'));
  assert.ok(model.ties.some((tie) => tie.id === 't01'));
  assert.equal(model.totalEighthUnits, 19);
  assert.equal(model.track.id, 'original-en');
});

test('duration, pitch, and playback mappings are deterministic', () => {
  assert.deepEqual(decomposeDuration(1), [{ units: 1, duration: '8', dots: 0 }]);
  assert.deepEqual(decomposeDuration(3), [{ units: 3, duration: 'qd', dots: 1 }]);
  assert.deepEqual(decomposeDuration(5), [
    { units: 4, duration: 'h', dots: 0 },
    { units: 1, duration: '8', dots: 0 },
  ]);
  assert.equal(pitchToVexKey('1', 'C major'), 'c/4');
  assert.equal(pitchToVexKey('5^', 'C major'), 'g/5');
  assert.equal(pitchToVexKey('4_', 'C major'), 'f/3');
  assert.equal(pitchToVexKey('7_', 'G major'), 'f/4');
  assert.ok(Math.abs(pitchToFrequency('6', 'C major') - 440) < 0.001);
});

test('system breaking uses measure and lyric width instead of a fixed event count', async () => {
  const { fixtures } = await loadProject();
  const fixture = fixtures.fixtures[0];
  const track = fixture.lyric_tracks[0];
  const wide = splitMeasuresByRequiredWidth(fixture, track, 2000);
  const normal = splitMeasuresByRequiredWidth(fixture, track, 700);
  const narrow = splitMeasuresByRequiredWidth(fixture, track, 260);
  assert.deepEqual(wide.map((system) => system.length), [4]);
  assert.deepEqual(normal.map((system) => system.length), [2, 2]);
  assert.ok(narrow.length > normal.length);
  assert.deepEqual(narrow.flat(), fixture.measures);
});

test('unverified public content is rejected', async () => {
  const { book, fixtures } = await loadProject();
  const invalidBook = clone(book);
  const candidate = clone(fixtures.fixtures[0]);
  candidate.synthetic = false;
  candidate.status = 'unverified';
  candidate.source = {};
  candidate.verification = {};
  invalidBook.library.songs.push(candidate);
  const result = validateProject(invalidBook, fixtures);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some((error) => error.code === 'public-status'));
  assert.ok(result.errors.some((error) => error.code === 'source-field'));
  assert.ok(result.errors.some((error) => error.code === 'verification-field'));
});

test('embedded lyrics and lyrics attached to rests are rejected', async () => {
  const { book, fixtures } = await loadProject();
  const invalidFixtures = clone(fixtures);
  invalidFixtures.fixtures[0].measures[1].events[0].lyric = 'bad';
  invalidFixtures.fixtures[0].lyric_tracks[0].syllables.push({ event: 'r01', text: 'rest' });
  const result = validateProject(book, invalidFixtures);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some((error) => error.code === 'event-embedded-lyric'));
  assert.ok(result.errors.some((error) => error.code === 'lyric-event'));
});

test('invalid baseline and visual geometry are rejected', async () => {
  const { book, fixtures } = await loadProject();
  const invalidBook = clone(book);
  invalidBook.notation.lyrics.vertical_alignment = 'per_note';
  invalidBook.layout.system_geometry.lyric_row.max_vertical_alignment_delta_px = -1;
  invalidBook.gates.visual.measurements.numbered_to_staff_top_line_gap_px = { min: 20, max: 10 };
  const result = validateProject(invalidBook, fixtures);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some((error) => error.code === 'lyric-rendering'));
  assert.ok(result.errors.some((error) => error.code === 'lyric-row-geometry'));
  assert.ok(result.errors.some((error) => error.code === 'visual-gap-range'));
});

test('build output uses pointer rectangles and scorebook-derived standard label positions', async () => {
  const [distBook, distFixtures, designCss, html, appSource, audioSource, rendererSource, visualSource, styles] = await Promise.all([
    readFile('dist/scorebook.json', 'utf8'),
    readFile('dist/fixtures.json', 'utf8'),
    readFile('dist/design.css', 'utf8'),
    readFile('dist/index.html', 'utf8'),
    readFile('dist/app.js', 'utf8'),
    readFile('dist/audio.js', 'utf8'),
    readFile('dist/staff-renderer.js', 'utf8'),
    readFile('tests/visual.spec.mjs', 'utf8'),
    readFile('dist/styles.css', 'utf8'),
  ]);
  assert.equal(JSON.parse(distBook).library.songs.length, 0);
  assert.equal(JSON.parse(distFixtures).fixtures[0].synthetic, true);
  assert.match(designCss, /--staff-width: 700px/);
  assert.match(designCss, /--numbered-row-height: 50px/);
  assert.match(designCss, /--numbered-note-height: 52px/);
  assert.match(designCss, /--lyric-alignment-tolerance: 1px/);
  assert.match(designCss, /--glyph-collision-clearance: 6px/);
  assert.match(designCss, /--maximum-event-vertical-shift: 32px/);
  assert.match(html, /正式曲庫/);
  assert.match(html, /本機 Studio/);
  assert.match(appSource, /geometry: book\.layout\.system_geometry/);
  assert.match(audioSource, /AudioContext/);
  assert.doesNotMatch(rendererSource, /new Annotation|lyricAnnotations|defaultNumberRect|defaultLyricRect|system\.getBoundingClientRect\(\)/);
  assert.match(rendererSource, /note\.getSVGElement\(\)/);
  assert.match(rendererSource, /querySelector\('rect\[opacity="0"\]\[pointer-events="auto"\]'\)/);
  assert.match(rendererSource, /const defaultNumberBottom = numberedNoteHeight/);
  assert.match(rendererSource, /const defaultLyricTop = lyricRowTop/);
  assert.match(rendererSource, /scorebook-system-geometry/);
  assert.match(rendererSource, /vexflow-stavenote-pointer-rect/);
  assert.match(rendererSource, /verticalShiftPx/);
  assert.match(styles, /height:\s*var\(--numbered-note-height, 52px\)/);
  assert.match(visualSource, /synthetic-fixture-second-system\.png/);
  assert.match(visualSource, /requiredMagnitude/);
  assert.match(visualSource, /extremeLabels/);
  assert.match(visualSource, /allBoundingSourcesPass/);
});

test('package versions and required extreme-note gates are pinned', async () => {
  const { book } = await loadProject();
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(packageJson.version, '0.6.6');
  assert.equal(packageJson.dependencies.vexflow, '5.0.0');
  assert.equal(packageJson.devDependencies['@playwright/test'], '1.55.0');
  assert.ok(book.gates.fixture.checks.includes('fixture_renders_at_least_two_systems'));
  assert.ok(book.gates.fixture.checks.includes('fixture_contains_instrument_lowest_note'));
  assert.ok(book.gates.fixture.checks.includes('fixture_contains_instrument_highest_note'));
  assert.ok(book.gates.html.checks.includes('standard_label_positions_are_derived_from_scorebook_geometry'));
  assert.ok(book.gates.html.checks.includes('hidden_studio_rendering_does_not_depend_on_dom_rects'));
  assert.ok(book.gates.html.checks.includes('per_event_adjustment_uses_vexflow_stavenote_pointer_rect'));
  assert.ok(book.gates.visual.checks.includes('uncollided_events_keep_zero_vertical_shift'));
  assert.ok(book.gates.visual.checks.includes('colliding_numbered_notation_moves_up_only'));
  assert.ok(book.gates.visual.checks.includes('colliding_lyric_moves_down_only'));
  assert.ok(book.gates.visual.checks.includes('each_extreme_event_adjusts_only_the_labels_that_need_it'));
  for (const gate of ['content', 'fixture', 'html', 'visual', 'print', 'release']) {
    assert.equal(book.gates[gate].required, true, `${gate} gate must be required`);
  }
});
