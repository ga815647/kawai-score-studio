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

const expectedSongs = {
  "hickory-dickory-dock": {
    "meter": "6/8",
    "key": "C major",
    "measureCount": 10,
    "eventCount": 32,
    "noteCount": 30,
    "restCount": 2,
    "lyricCount": 28,
    "pitches": "3 4 5 4 2 3 3 rest 3 3 5 4 1 3 rest 3 3 3 5 5 4 4 6 6 5 6 5 4 3 2 1 1",
    "durations": "1 1 1 1 1 1 4 1 1 2 1 2 1 4 1 1 2 1 2 1 2 1 3 6 1 1 1 1 1 1 6 6",
    "lyrics": "HickoryDickoryDock,themouseranuptheclock.Theclockstruckone,themouserandown,HickoryDickoryDock."
  },
  "twinkle-twinkle-little-star-zh": {
    "meter": "4/4",
    "key": "C major",
    "measureCount": 12,
    "eventCount": 42,
    "noteCount": 42,
    "restCount": 0,
    "lyricCount": 42,
    "pitches": "1 1 5 5 6 6 5 4 4 3 3 2 2 1 5 5 4 4 3 3 2 5 5 4 4 3 3 2 1 1 5 5 6 6 5 4 4 3 3 2 2 1",
    "durations": "2 2 2 2 2 2 4 2 2 2 2 2 2 4 2 2 2 2 2 2 4 2 2 2 2 2 2 4 2 2 2 2 2 2 4 2 2 2 2 2 2 4",
    "lyrics": "一閃一閃亮晶晶滿天都是小星星掛在天上放光明好像許多小眼睛一閃一閃亮晶晶滿天都是小星星"
  },
  "two-tigers-zh": {
    "meter": "4/4",
    "key": "C major",
    "measureCount": 8,
    "eventCount": 32,
    "noteCount": 32,
    "restCount": 0,
    "lyricCount": 32,
    "pitches": "1 2 3 1 1 2 3 1 3 4 5 3 4 5 5 6 5 4 3 1 5 6 5 4 3 1 2 5_ 1 2 5_ 1",
    "durations": "2 2 2 2 2 2 2 2 2 2 4 2 2 4 1 1 1 1 2 2 1 1 1 1 2 2 2 2 4 2 2 4",
    "lyrics": "兩隻老虎兩隻老虎跑得快跑得快一隻沒有眼睛一隻沒有尾巴真奇怪真奇怪"
  },
  "old-macdonald-zh": {
    "meter": "4/4",
    "key": "C major",
    "measureCount": 16,
    "eventCount": 59,
    "noteCount": 58,
    "restCount": 1,
    "lyricCount": 58,
    "pitches": "1 1 1 5_ 6_ 6_ 5_ 3 3 2 2 1 rest 1 1 1 5_ 6_ 6_ 5_ 3 3 2 2 1 5_ 5_ 1 1 1 5_ 5_ 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 5_ 6_ 6_ 5_ 3 3 2 2 1",
    "durations": "2 2 2 2 2 2 4 2 2 2 2 6 2 2 2 2 2 2 2 4 2 2 2 2 6 1 1 2 2 2 1 1 2 2 4 1 1 2 1 1 2 1 1 1 1 2 2 2 2 2 2 2 2 4 2 2 2 2 8",
    "lyrics": "王老先生有塊地咿呀咿呀呦他在田邊養小雞咿呀咿呀呦這裡嘰嘰嘰那裡嘰嘰嘰這裡嘰那裡嘰到處都在嘰嘰王老先生有塊地咿呀咿呀呦"
  },
  "mary-had-a-little-lamb-zh": {
    "meter": "4/4",
    "key": "C major",
    "measureCount": 8,
    "eventCount": 25,
    "noteCount": 25,
    "restCount": 0,
    "lyricCount": 25,
    "pitches": "3 2 1 2 3 3 3 2 2 2 3 5 5 3 2 1 2 3 3 3 2 2 3 2 1",
    "durations": "2 2 2 2 2 2 4 2 2 4 2 2 4 2 2 2 2 2 2 4 2 2 2 2 8",
    "lyrics": "瑪麗有隻小綿羊小綿羊小綿羊瑪麗有隻小綿羊生得真漂亮"
  },
  "happy-birthday-zh": {
    "meter": "3/4",
    "key": "C major",
    "measureCount": 8,
    "eventCount": 25,
    "noteCount": 25,
    "restCount": 0,
    "lyricCount": 24,
    "pitches": "5 5 6 5 1^ 7 5 5 6 5 2^ 1^ 5 5 5^ 3^ 1^ 7 6 4^ 4^ 3^ 1^ 2^ 1^",
    "durations": "1 1 2 2 2 4 1 1 2 2 2 4 1 1 2 2 2 2 2 1 1 2 2 2 4",
    "lyrics": "祝你生日快樂祝你生日快樂祝你生日快樂祝你生日快樂"
  }
};

test('formal specification, six verified songs, and synthetic fixtures pass structural gates', async () => {
  const { book, fixtures } = await loadProject();
  const result = validateProject(book, fixtures);
  assert.equal(result.pass, true, JSON.stringify(result.errors, null, 2));
  assert.equal(book.project.version, '0.6.13');
  assert.deepEqual(result.counts, {
    verifiedSongs: 6,
    quarantinedEntries: 1,
    fixtures: 1,
  });
  assert.deepEqual(book.library.songs.map((song) => song.id), Object.keys(expectedSongs));
  assert.deepEqual(book.library.quarantine.map((entry) => entry.id), ['itsy-bitsy-spider']);
});

test('all verified song events, rhythms, lyrics, and source locators match the fixed variants', async () => {
  const { book } = await loadProject();
  for (const song of book.library.songs) {
    const expected = expectedSongs[song.id];
    assert.ok(expected, `unexpected song ${song.id}`);
    const events = flattenEvents(song);
    const track = song.lyric_tracks.find((candidate) => candidate.default);
    assert.equal(song.status, 'verified');
    assert.equal(song.key, expected.key);
    assert.equal(song.meter, expected.meter);
    assert.equal(song.measures.length, expected.measureCount);
    assert.equal(events.length, expected.eventCount);
    assert.equal(events.filter((event) => event.kind === 'note').length, expected.noteCount);
    assert.equal(events.filter((event) => event.kind === 'rest').length, expected.restCount);
    assert.equal(track.syllables.length, expected.lyricCount);
    assert.equal(events.map((event) => event.pitch ?? 'rest').join(' '), expected.pitches);
    assert.equal(events.map((event) => event.duration).join(' '), expected.durations);
    assert.equal(track.syllables.map((syllable) => syllable.text.replaceAll('-', '')).join(''), expected.lyrics);
    assert.match(song.source.url, /^https:\/\//);
    assert.equal(song.source.publisher, song.source.publisher_or_origin);
    assert.equal(song.verification.source_to_scorebook_checked, true);
    assert.ok(Object.values(song.verification).every((value) => value === true));
    assert.ok(events.every((event) => !('lyric' in event) && !('text' in event)));
  }
});

test('Chinese familiar-song batch is fixed to the selected static sources and playable range', async () => {
  const { book } = await loadProject();
  const chineseSongs = book.library.songs.filter((song) => song.id.endsWith('-zh'));
  assert.equal(chineseSongs.length, 5);
  assert.deepEqual(chineseSongs.map((song) => song.title), [
    '小星星',
    '兩隻老虎',
    '王老先生有塊地',
    '瑪麗有隻小綿羊',
    '生日快樂',
  ]);
  for (const song of chineseSongs) {
    const track = song.lyric_tracks.find((candidate) => candidate.default);
    assert.equal(track.locale, 'zh-TW');
    assert.equal(track.role, 'original');
    assert.equal(track.status, 'verified');
    assert.equal(song.source.provided_by, 'assistant_web_research');
  }

  const birthday = chineseSongs.find((song) => song.id === 'happy-birthday-zh');
  assert.equal(birthday.source.fixed_upstream_repository, 'musetrainer/library');
  assert.equal(birthday.source.fixed_upstream_commit, '9128876f6164d96997c877a2be843349a32bdabb');
  assert.equal(birthday.source.fixed_upstream_blob_sha, 'c86348d7cb0ab39eefb052026e7d368a2e968d0e');
  assert.deepEqual(birthday.lyric_tracks[0].continuations, [{ from: 'n18', through: 'n19' }]);
  assert.ok(flattenEvents(birthday).some((event) => event.pitch === '5^'));

  const oldMacDonald = chineseSongs.find((song) => song.id === 'old-macdonald-zh');
  assert.equal(flattenEvents(oldMacDonald).filter((event) => event.kind === 'rest').length, 1);
  assert.ok(flattenEvents(oldMacDonald).some((event) => event.pitch === '5_'));
});

test('Hickory cross-measure ties remain on the same systems', async () => {
  const { book } = await loadProject();
  const song = book.library.songs.find((candidate) => candidate.id === 'hickory-dickory-dock');
  const track = song.lyric_tracks.find((candidate) => candidate.default);
  assert.deepEqual(song.ties, [
    { id: 't01', from: 'n21', to: 'n22' },
    { id: 't02', from: 'n29', to: 'n30' },
  ]);
  const systems = splitMeasuresByRequiredWidth(
    song,
    track,
    book.layout.system_breaking.verified_song_width_budget_px,
  );
  const systemByEvent = new Map();
  systems.forEach((system, systemIndex) => {
    system.flatMap((measure) => measure.events)
      .forEach((event) => systemByEvent.set(event.id, systemIndex));
  });
  for (const tie of song.ties) {
    assert.equal(systemByEvent.get(tie.from), systemByEvent.get(tie.to));
  }
});

test('layout and source policies preserve formal rows, lyric spacing, and static-source rules', async () => {
  const { book } = await loadProject();
  assert.deepEqual(book.layout.vertical_order, ['numbered_notation', 'staff', 'lyrics']);
  assert.equal(book.layout.system_geometry.locked_standard_rows.numbered_row_top_px, 0);
  assert.equal(book.layout.system_geometry.locked_standard_rows.lyric_row_top_px, 120);
  assert.equal(book.layout.system_breaking.verified_song_width_budget_px, 600);
  assert.equal(book.layout.system_breaking.minimum_horizontal_lyric_gap_px, 8);
  assert.equal(book.layout.system_breaking.maximum_horizontal_shift_px, 24);
  assert.equal(book.content_policy.localized_variant_requires_exact_static_lyric_source, true);
  assert.ok(book.gates.content.checks.includes('selected_traditional_localized_variant_is_exactly_sourced'));
  assert.ok(book.gates.visual.checks.includes('all_verified_library_songs_render'));
});

test('fixture and rendering engines still cover rests, ties, lyrics, and both instrument extremes', async () => {
  const { book, fixtures } = await loadProject();
  const fixture = fixtures.fixtures[0];
  const events = flattenEvents(fixture);
  assert.equal(fixture.synthetic, true);
  assert.ok(events.some((event) => event.kind === 'rest'));
  assert.ok(events.some((event) => event.pitch === book.instrument.lowest_note));
  assert.ok(events.some((event) => event.pitch === book.instrument.highest_note));
  const model = createRenderModel(fixture);
  assert.ok(model.segments.some((segment) => segment.lyric === 'extraordinary'));
  assert.ok(model.ties.some((tie) => tie.id === 't01'));
  assert.equal(pitchToVexKey('1', 'C major'), 'c/4');
  assert.equal(pitchToVexKey('5^', 'C major'), 'g/5');
  assert.ok(Math.abs(pitchToFrequency('6', 'C major') - 440) < 0.001);
  assert.deepEqual(parseMeter('3/4'), { numerator: 3, denominator: 4, capacityEighthUnits: 6 });
});

test('invalid unverified content, embedded lyrics, and lyrics attached to rests are rejected', async () => {
  const { book, fixtures } = await loadProject();

  const unverified = clone(book);
  unverified.library.songs[1].status = 'unverified';
  assert.ok(validateProject(unverified, fixtures).errors.some((error) => error.code === 'public-status'));

  const embedded = clone(book);
  embedded.library.songs[1].measures[0].events[0].lyric = 'bad';
  assert.ok(validateProject(embedded, fixtures).errors.some((error) => error.code === 'event-embedded-lyric'));

  const restLyric = clone(book);
  restLyric.library.songs.find((song) => song.id === 'old-macdonald-zh')
    .lyric_tracks[0].syllables.push({ event: 'r01', text: 'bad' });
  assert.ok(validateProject(restLyric, fixtures).errors.some((error) => error.code === 'lyric-event'));
});

test('build output and package version contain the complete verified library', async () => {
  const [distBook, packageJson, rendererSource] = await Promise.all([
    readFile('dist/scorebook.json', 'utf8'),
    readFile('package.json', 'utf8'),
    readFile('dist/staff-renderer.js', 'utf8'),
  ]);
  const dist = JSON.parse(distBook);
  const pkg = JSON.parse(packageJson);
  assert.equal(dist.library.songs.length, 6);
  assert.equal(pkg.version, '0.6.13');
  assert.equal(pkg.dependencies.vexflow, '5.0.0');
  assert.equal(pkg.devDependencies['@playwright/test'], '1.55.0');
  assert.match(rendererSource, /applyHorizontalLyricSpacing/);
  assert.match(rendererSource, /forbiddenTieBreaks/);
});

test('every required gate remains enabled', async () => {
  const { book } = await loadProject();
  for (const gate of ['content', 'fixture', 'source', 'html', 'visual', 'print', 'release']) {
    assert.equal(book.gates[gate].required, true, `${gate} gate must be required`);
  }
});
