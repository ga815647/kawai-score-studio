import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { decomposeDuration } from '../src/score-engine.js';
import {
  flattenEvents,
  loadFixtures,
  loadScorebook,
  validateProject,
} from '../scripts/lib.mjs';

async function loadProject() {
  const [{ data: book }, { data: fixtures }] = await Promise.all([
    loadScorebook(),
    loadFixtures(),
  ]);
  return { book, fixtures };
}

test('0.6.24 has thirty-one verified songs, no quarantine, and passes structural gates', async () => {
  const { book, fixtures } = await loadProject();
  const result = validateProject(book, fixtures);
  assert.equal(result.pass, true, JSON.stringify(result.errors, null, 2));
  assert.equal(book.project.version, '0.6.24');
  assert.equal(book.schema.duration_quantum_eighth_units, 0.5);
  assert.equal(book.schema.smallest_supported_duration, 'sixteenth_note');
  assert.deepEqual(result.counts, {
    verifiedSongs: 31,
    quarantinedEntries: 0,
    fixtures: 1,
  });
  assert.deepEqual(book.library.songs.map((song) => song.id), [
    'hickory-dickory-dock',
    'itsy-bitsy-spider',
    'twinkle-twinkle-little-star-zh',
    'two-tigers-zh',
    'old-macdonald-zh',
    'mary-had-a-little-lamb-zh',
    'happy-birthday-zh',
    'row-row-row-your-boat',
    'the-wheels-on-the-bus',
    'canon-in-d',
    'yi-bi-ya-ya-zh',
    'little-bee-zh',
    'fast-train-zh',
    'pull-the-radish-zh',
    'build-an-airplane-zh',
    'tantan-houhou',
    'humpty-dumpty',
    'little-donkey-zh',
    'find-a-friend-zh',
    'london-bridge-zh',
    'if-you-are-happy-clap-zh',
    'head-shoulders-knees-and-toes',
    'five-little-ducks',
    'i-am-a-painter-zh',
    'counting-ducks-zh',
    'little-rabbit-be-good-zh',
    'bingo',
    'this-old-man',
    'clay-doll-zh',
    'drop-the-handkerchief-zh',
    'telephone-call-zh',
  ]);
});

test('public website has a song directory and no public Studio or quarantine panel', async () => {
  const { book } = await loadProject();
  assert.equal(book.interaction_entry.public_website_mode, 'library_only');
  assert.equal(book.interaction_entry.internal_test_route, 'fixture_query_only');
  assert.deepEqual(book.interaction_entry.website_modes_remain_internal, ['library', 'studio']);
  assert.deepEqual(book.interaction_entry.public_sections, ['status', 'song_directory', 'verified_library']);
  assert.deepEqual(book.interaction_entry.internal_routes, ['fixture_query_only']);

  assert.equal(book.modes.library.public, true);
  assert.deepEqual(book.modes.library.song_controls, ['play', 'stop', 'print']);
  assert.equal(book.modes.library.print_button_label, 'A4 列印');
  assert.equal(book.modes.library.print_behavior, 'selected_song_only');
  assert.equal(book.modes.library.public_quarantine_panel, false);
  assert.deepEqual(book.modes.library.song_directory, {
    public: true,
    position: 'before_library_heading',
    entries: 'verified_songs',
    label_format: 'title_with_alias',
    link_behavior: 'same_page_anchor',
  });

  assert.equal(book.modes.studio.public, false);
  assert.equal(book.modes.studio.public_navigation, false);
  assert.equal(book.modes.studio.local_draft_input, 'disabled_on_public_site');
  assert.equal(book.modes.synthetic_fixture.public_navigation, false);
  assert.equal(book.modes.synthetic_fixture.route_query_parameter, 'fixture');

  assert.deepEqual(book.layout.navigation.song_directory, {
    position: 'before_library_heading',
    source: 'verified_songs',
    anchor_prefix: 'song-',
    label_format: 'title_with_alias',
    sticky_header_offset_px: 88,
  });
});

test('The Itsy Bitsy Spider exactly models the selected F-major 6/8 PDF', async () => {
  const { book } = await loadProject();
  const song = book.library.songs.find((candidate) => candidate.id === 'itsy-bitsy-spider');
  assert.ok(song);
  assert.equal(song.title, 'The Itsy Bitsy Spider');
  assert.equal(song.alias, '小小蜘蛛');
  assert.equal(song.key, 'F major');
  assert.equal(song.meter, '6/8');
  assert.equal(song.pickup_eighth_units, 1);
  assert.equal(song.measures.length, 17);
  assert.deepEqual(song.measures[0], {
    number: 0,
    capacity_eighth_units: 1,
    events: [{ id: 'n01', kind: 'note', pitch: '5_', duration: 1 }],
    pickup: true,
  });

  const events = flattenEvents(song);
  const track = song.lyric_tracks.find((candidate) => candidate.default);
  assert.equal(events.length, 48);
  assert.equal(events.filter((event) => event.kind === 'note').length, 47);
  assert.equal(events.filter((event) => event.kind === 'rest').length, 1);
  assert.equal(track.locale, 'en');
  assert.equal(track.role, 'original');
  assert.equal(track.syllables.length, 47);
  assert.equal(
    track.syllables.map((syllable) => syllable.text).join(' '),
    'The it- sy bit- sy spi- der went up the wa- ter spout. Down came the rain and washed the spi- der out! Out came the sun and dried up all the rain And the it- sy bit- sy spi- der climbed up the spout a- gain!',
  );
  assert.deepEqual(song.measures[12].events, [
    { id: 'n33', kind: 'note', pitch: '1', duration: 2 },
    { id: 'r01', kind: 'rest', duration: 1 },
    { id: 'n34', kind: 'note', pitch: '5_', duration: 2 },
    { id: 'n35', kind: 'note', pitch: '5_', duration: 1 },
  ]);
  assert.deepEqual(song.ties, []);
  assert.equal(song.source.file_reference, 'The-Itsy-Bitsy-Spider-F-Major.pdf');
  assert.equal(song.source.content_sha256, '180ad5ac50ea5c057abe74632e798057406cace2aeb31d652e24f2505c476ded');
  assert.equal(song.source.publisher, 'Michael Kravchuk');
  assert.equal(song.source.selected_variant, 'F-major 6/8 complete classic English verse');
  assert.ok(Object.values(song.verification).every((value) => value === true));
});

test('Row, Row, Row Your Boat exactly models the selected C-major 3/4 PDF', async () => {
  const { book } = await loadProject();
  const song = book.library.songs.find((candidate) => candidate.id === 'row-row-row-your-boat');
  assert.ok(song);
  assert.equal(song.key, 'C major');
  assert.equal(song.meter, '3/4');
  assert.equal(song.pickup_eighth_units, 0);
  assert.equal(song.measures.length, 16);
  assert.deepEqual(flattenEvents(song).map((event) => [event.pitch, event.duration]), [
    ['1', 6], ['1', 6], ['1', 4], ['2', 2], ['3', 6],
    ['3', 4], ['2', 2], ['3', 4], ['4', 2], ['5', 6], ['5', 6],
    ['1^', 2], ['1^', 2], ['1^', 2], ['5', 2], ['5', 2], ['5', 2],
    ['3', 2], ['3', 2], ['3', 2], ['1', 2], ['1', 2], ['1', 2],
    ['5', 4], ['4', 2], ['3', 4], ['2', 2], ['1', 6], ['1', 6],
  ]);
  assert.deepEqual(song.ties, [
    { id: 't01', from: 'n10', to: 'n11' },
    { id: 't02', from: 'n28', to: 'n29' },
  ]);
  const track = song.lyric_tracks.find((candidate) => candidate.default);
  assert.equal(track.locale, 'en');
  assert.equal(track.role, 'original');
  assert.equal(track.syllables.map((item) => item.text).join(' '),
    'Row, row, row your boat. Gent- ly down the stream. Mer- ri- ly, mer- ri- ly, mer- ri- ly, mer- ri- ly. Life is but a dream.');
  assert.deepEqual(track.continuations, [
    { from: 'n10', through: 'n11' },
    { from: 'n28', through: 'n29' },
  ]);
  assert.equal(song.source.url, 'https://pianosongdownload.com/Row%20Row%20Row%20Your%20Boat.pdf');
  assert.ok(Object.values(song.verification).every((value) => value === true));
});

test('The Wheels on the Bus exactly models the selected C-major 2/4 PDF', async () => {
  const { book } = await loadProject();
  const song = book.library.songs.find((candidate) => candidate.id === 'the-wheels-on-the-bus');
  assert.ok(song);
  assert.equal(song.key, 'C major');
  assert.equal(song.meter, '2/4');
  assert.equal(song.pickup_eighth_units, 2);
  assert.equal(song.measures.length, 16);
  assert.deepEqual(song.measures[0], {
    number: 0,
    capacity_eighth_units: 2,
    events: [{ id: 'n01', kind: 'note', pitch: '5', duration: 2 }],
    pickup: true,
  });
  assert.deepEqual(flattenEvents(song).map((event) => [event.pitch, event.duration]), [
    ['5', 2],
    ['1^', 2], ['1^', 1], ['1^', 1], ['1^', 2], ['3^', 2],
    ['5^', 2], ['3^', 2], ['1^', 4], ['2^', 2], ['7', 2], ['5', 4],
    ['5^', 2], ['3^', 2], ['1^', 2], ['5', 2],
    ['1^', 2], ['1^', 1], ['1^', 1], ['1^', 2], ['3^', 2],
    ['5^', 2], ['3^', 2], ['1^', 4], ['2^', 4], ['5', 3], ['5', 1], ['1^', 4],
  ]);
  assert.deepEqual(song.ties, []);
  const track = song.lyric_tracks.find((candidate) => candidate.default);
  assert.equal(track.locale, 'en');
  assert.equal(track.role, 'original');
  assert.equal(track.syllables.map((item) => item.text).join(' '),
    'The wheels on the bus go round and round, round and round, round and round. The wheels on the bus go round and round, all around the town.');
  assert.equal(song.source.url, 'https://www.kidsplaymusic.com/wp-content/uploads/2024/06/Wheels-on-the-Bus-Piano-Sheet-Music.pdf');
  assert.ok(Object.values(song.verification).every((value) => value === true));
});

test('Canon in D exactly models the selected 32-measure xylophone excerpt', async () => {
  const { book } = await loadProject();
  const song = book.library.songs.find((candidate) => candidate.id === 'canon-in-d');
  assert.ok(song);
  assert.equal(song.title, 'Canon in D');
  assert.equal(song.alias, '卡農主題');
  assert.equal(song.key, 'C major');
  assert.equal(song.meter, '4/4');
  assert.equal(song.pickup_eighth_units, 0);
  assert.equal(song.measures.length, 32);

  const events = flattenEvents(song);
  assert.equal(events.length, 292);
  assert.equal(events.filter((event) => event.duration === 0.5).length, 172);
  assert.ok(song.measures.every((measure) => measure.events.reduce((sum, event) => sum + event.duration, 0) === 8));
  const compactMeasures = song.measures.map((measure) => measure.events.map((event) => [event.pitch, event.duration]));
  const digest = createHash('sha256').update(JSON.stringify(compactMeasures)).digest('hex');
  assert.equal(digest, 'f0f4fb50337b01533001b537db981283084b75dea6f00910665a90694e639271');
  assert.deepEqual(decomposeDuration(0.5), [{ units: 0.5, duration: '16', dots: 0 }]);
  assert.deepEqual(decomposeDuration(1.5), [{ units: 1.5, duration: '8d', dots: 1 }]);

  assert.deepEqual(song.ties, []);
  const track = song.lyric_tracks.find((candidate) => candidate.default);
  assert.equal(track.id, 'instrumental');
  assert.equal(track.locale, 'zxx');
  assert.equal(track.role, 'original');
  assert.deepEqual(track.syllables, []);
  assert.equal(song.source.original_key, 'D major');
  assert.equal(song.source.selected_source_measures, '5-12, 35-50, 61-68');
  assert.equal(song.source.transposition_semitones, -2);
  assert.match(song.source.selected_variant, /no octave folding/);
  assert.equal(song.source.url, 'https://musescore.org/sites/musescore.org/files/2020-09/Canon_in_D.pdf');
  assert.equal(song.source.supporting_sources[0].file_reference, 'Canon_in_D.mxl');
  assert.equal(song.source.supporting_sources[0].content_sha256, '23762273abf1d6bd7001c89dc620bee6accf0045573078e2865e086df2f1bb14');
  assert.ok(Object.values(song.verification).every((value) => value === true));
});


test('five Chinese nursery songs exactly model the selected Jianpu Space sources', async () => {
  const { book } = await loadProject();
  const specs = {
  "yi-bi-ya-ya-zh": {
    "title": "依比呀呀",
    "meter": "2/4",
    "pickup": 2,
    "measures": 17,
    "notes": 42,
    "lyrics": 39,
    "ties": 3,
    "url": "https://jianpu.space/zh-tw/songList/65c3bad62cce837239c1fba6",
    "digest": "7239ca889456acee0d278afa5eb9ec0165f260477249f02210055608aba3422d"
  },
  "little-bee-zh": {
    "title": "小蜜蜂",
    "meter": "4/4",
    "pickup": 0,
    "measures": 16,
    "notes": 49,
    "lyrics": 49,
    "ties": 0,
    "url": "https://jianpu.space/zh-tw/songList/2",
    "digest": "6e33d73908fc551f8c8353a95e386c87cbeabfc11ee1b50d5b138177386e51e9"
  },
  "fast-train-zh": {
    "title": "火車快飛",
    "meter": "2/4",
    "pickup": 0,
    "measures": 10,
    "notes": 38,
    "lyrics": 38,
    "ties": 0,
    "url": "https://jianpu.space/zh-tw/songList/10",
    "digest": "9e6cf957eab6d26f1676d1fd23d4a5261cf543ef24277c6e623f99548a8f549c"
  },
  "pull-the-radish-zh": {
    "title": "拔蘿蔔",
    "meter": "2/4",
    "pickup": 0,
    "measures": 10,
    "notes": 34,
    "lyrics": 34,
    "ties": 0,
    "url": "https://jianpu.space/zh-tw/songList/66f8bf9618d7fae816dd13da",
    "digest": "69421e86c9de87ba1be52230a9fe189446b1b7d1a6d029c2754ebba2dbefe00a"
  },
  "build-an-airplane-zh": {
    "title": "造飛機",
    "meter": "2/4",
    "pickup": 0,
    "measures": 20,
    "notes": 55,
    "lyrics": 55,
    "ties": 0,
    "url": "https://jianpu.space/zh-tw/songList/66f94b2d18d7fae816dd13de",
    "digest": "0af3691fe4a0e10aa1690c01d93944d71ada1f2bb2891a4751db8e7e9eccf0ab"
  }
};
  for (const [id, spec] of Object.entries(specs)) {
    const song = book.library.songs.find((candidate) => candidate.id === id);
    assert.ok(song, id);
    assert.equal(song.title, spec.title);
    assert.equal(song.key, 'C major');
    assert.equal(song.meter, spec.meter);
    assert.equal(song.pickup_eighth_units, spec.pickup);
    assert.equal(song.measures.length, spec.measures);
    const events = flattenEvents(song);
    assert.equal(events.length, spec.notes);
    const track = song.lyric_tracks.find((candidate) => candidate.default);
    assert.equal(track.locale, 'zh-TW');
    assert.equal(track.role, 'original');
    assert.equal(track.syllables.length, spec.lyrics);
    assert.equal(song.ties.length, spec.ties);
    assert.equal(song.source.url, spec.url);
    const digest = createHash('sha256').update(JSON.stringify(
      events.map((event) => [event.kind, event.pitch ?? null, event.duration]),
    )).digest('hex');
    assert.equal(digest, spec.digest, id);
    assert.ok(Object.values(song.verification).every((value) => value === true));
  }
});


test('淡々泡々 exactly models the user-provided Guitar Pro melody reduction', async () => {
  const { book } = await loadProject();
  const song = book.library.songs.find((candidate) => candidate.id === 'tantan-houhou');
  assert.ok(song);
  assert.equal(song.title, '淡々泡々');
  assert.equal(song.key, 'C major');
  assert.equal(song.meter, '4/4');
  assert.equal(song.pickup_eighth_units, 0);
  assert.equal(song.measures.length, 21);

  const events = flattenEvents(song);
  assert.equal(events.length, 146);
  assert.equal(events.filter((event) => event.kind === 'note').length, 124);
  assert.equal(events.filter((event) => event.kind === 'rest').length, 22);
  assert.ok(song.measures.every(
    (measure) => measure.events.reduce((sum, event) => sum + event.duration, 0) === 8,
  ));
  const digest = createHash('sha256').update(JSON.stringify(
    events.map((event) => [event.kind, event.pitch ?? null, event.duration]),
  )).digest('hex');
  assert.equal(digest, 'a7067066c542894031632c34ec394cb8a83aadf80f65a2c1712dfcb3632c018e');

  assert.deepEqual(song.ties, [
    { id: 't01', from: 'n061', to: 'n062' },
    { id: 't02', from: 'n066', to: 'n067' },
    { id: 't03', from: 'n077', to: 'n078' },
    { id: 't04', from: 'n082', to: 'n083' },
    { id: 't05', from: 'n119', to: 'n120' },
    { id: 't06', from: 'n123', to: 'n124' },
  ]);
  const track = song.lyric_tracks.find((candidate) => candidate.default);
  assert.equal(track.id, 'instrumental');
  assert.equal(track.locale, 'zxx');
  assert.equal(track.role, 'original');
  assert.deepEqual(track.syllables, []);

  assert.equal(song.source.source_type, 'other_static_score_file');
  assert.equal(song.source.provided_by, 'user');
  assert.equal(song.source.file_reference, 'Desire Drive Light SOLO.gp');
  assert.equal(song.source.content_sha256, 'f5f93450a28afe535b643a63084169e2b129a904909128074af0146be9948af9');
  assert.equal(song.source.original_key, 'F# major');
  assert.equal(song.source.original_meter, '4/4');
  assert.equal(song.source.selected_source_measures, '2-22');
  assert.equal(song.source.transposition_semitones, -6);
  assert.equal(song.source.octave_folding, false);
  assert.match(song.source.melody_reduction, /strings 4 and 5/);
  assert.match(song.source.selected_variant, /omit leading all-rest source measure 1/);
  assert.match(song.source.selected_variant, /no octave folding/);
  assert.equal(
    song.source.supporting_sources[0].content_sha256,
    'd442f3aae5b3bcf52d3c06c94b704eac3b16287deb571dc449d4362af5bb6bac',
  );
  assert.ok(Object.values(song.verification).every((value) => value === true));
});

\ntest('BINGO, This Old Man, 泥娃娃, 丟手絹, and 打電話 pin the selected static-source reductions', async () => {\n  const { book } = await loadProject();\n  const specs = {\n    bingo: { title: 'BINGO', meter: '2/4', pickup: 1, measures: 13, notes: 37, lyrics: 37, rests: 1, digest: 'b90682ad2b9885c285ffaef5c05f67a70f557a69ed480e2362d874d7596bbee7' },\n    'this-old-man': { title: 'This Old Man', meter: '4/4', pickup: 0, measures: 8, notes: 32, lyrics: 32, rests: 0, digest: 'd5aaea07a1c6ffd4cfbc6de9f2694a099909954f6a5674d65adbb56722922382' },\n    'clay-doll-zh': { title: '泥娃娃', meter: '4/4', pickup: 0, measures: 8, notes: 26, lyrics: 26, rests: 2, digest: '7ddb8666951ad92729b899059f88e5a540458ba7d7094ad9f949ff1b70297ae4' },\n    'drop-the-handkerchief-zh': { title: '丟手絹', meter: '2/4', pickup: 0, measures: 17, notes: 41, lyrics: 37, rests: 0, digest: 'd43bacf7518f64e3ab60eb1637799b9e5b44a8ce787e6d173b1551a6e2df43ea' },\n    'telephone-call-zh': { title: '打電話', meter: '2/4', pickup: 0, measures: 12, notes: 29, lyrics: 28, rests: 6, digest: '73b702624282a7018f03d456ea3c091ed88c2c96850cdc808751ab7283c122bf' },\n  };\n  for (const [id, spec] of Object.entries(specs)) {\n    const song = book.library.songs.find((candidate) => candidate.id === id);\n    assert.ok(song, id);\n    assert.equal(song.title, spec.title);\n    assert.equal(song.key, 'C major');\n    assert.equal(song.meter, spec.meter);\n    assert.equal(song.pickup_eighth_units, spec.pickup);\n    assert.equal(song.measures.length, spec.measures);\n    const events = flattenEvents(song);\n    assert.equal(events.filter((event) => event.kind === 'note').length, spec.notes);\n    assert.equal(events.filter((event) => event.kind === 'rest').length, spec.rests);\n    const lyricTrack = song.lyric_tracks.find((candidate) => candidate.default);\n    assert.equal(lyricTrack.syllables.length, spec.lyrics);\n    const digest = createHash('sha256').update(JSON.stringify(\n      events.map((event) => [event.kind, event.pitch ?? null, event.duration]),\n    )).digest('hex');\n    assert.equal(digest, spec.digest, id);\n    assert.ok(Object.values(song.verification).every((value) => value === true));\n  }\n  const bingo = book.library.songs.find((song) => song.id === 'bingo');\n  assert.equal(bingo.source.url, 'https://www.musicyoucanread.com/SONGS/00-BINGO.html');\n  assert.equal(bingo.source.transposition_semitones, -7);\n  const oldMan = book.library.songs.find((song) => song.id === 'this-old-man');\n  assert.equal(oldMan.source.supporting_sources[0].url.startsWith('https://abcnotation.com/'), true);\n  const clay = book.library.songs.find((song) => song.id === 'clay-doll-zh');\n  assert.match(clay.source.octave_adaptation, /lower-octave comma-marked notes/);\n  const handkerchief = book.library.songs.find((song) => song.id === 'drop-the-handkerchief-zh');\n  assert.equal(handkerchief.source.original_key, 'E major');\n  assert.equal(handkerchief.source.transposition_semitones, -4);\n  const phone = book.library.songs.find((song) => song.id === 'telephone-call-zh');\n  assert.equal(phone.source.selected_source_page, 146);\n  assert.equal(phone.measures[9].events.at(-1).id, 'n24');\n  assert.equal(phone.lyric_tracks[0].syllables.some((item) => item.event === 'n24'), false);\n});\n\ntest('A4 print contract selects one verified song and permits page breaks only between systems', async () => {
  const { book } = await loadProject();
  assert.deepEqual(book.layout.print, {
    page_size: 'A4',
    orientation: 'portrait',
    margin_mm: 12,
    selected_song_only: true,
    synthetic_fixture_must_not_print_from_library: true,
    horizontal_clipping: 'forbidden',
    system_break_inside: 'forbidden',
    allowed_page_breaks: ['between_complete_systems'],
    multi_page_when_needed: true,
    unreadable_shrink_to_fit: 'forbidden',
    button_label: 'A4 列印',
  });
  for (const check of [
    'selected_verified_song_only',
    'synthetic_fixture_is_never_printed_from_library',
    'page_breaks_only_between_complete_systems',
    'complete_system_is_not_split',
    'multi_page_output_remains_readable',
  ]) {
    assert.ok(book.gates.print.checks.includes(check));
  }
});

test('public HTML source has directory, explicit A4 controls, cache versioning, no quarantine panel, and only a hidden internal fixture route', async () => {
  const [template, app, css, build] = await Promise.all([
    readFile('src/index.template.html', 'utf8'),
    readFile('src/app.js', 'utf8'),
    readFile('src/styles.css', 'utf8'),
    readFile('scripts/build.mjs', 'utf8'),
  ]);

  assert.match(template, /id="song-directory"/);
  assert.match(template, /id="song-directory-list"/);
  assert.match(template, /id="studio-view" hidden aria-label="內部合成測試"/);
  assert.match(template, /id="fixture-view"/);
  assert.doesNotMatch(template, /quarantine-panel|quarantine-list|本機 Studio|查看隔離中的舊曲目/);

  assert.match(app, /createButton\('print', 'A4 列印'\)/);
  assert.match(app, /scoreAnchor\(song\)/);
  assert.match(app, /scrollIntoView/);
  assert.match(app, /build-info\.json/);
  assert.match(app, /reloadCurrentBuildIfNeeded/);
  assert.doesNotMatch(app, /quarantinePanel|quarantineList|studio-tab|draft-editor/);
  assert.doesNotMatch(app, /localStorage|draft-editor|load-fixture|save-draft/);

  assert.match(template, /styles\.css\?v=\{\{ASSET_VERSION\}\}/);
  assert.match(template, /app\.js\?v=\{\{ASSET_VERSION\}\}/);
  assert.match(build, /build-info\.json/);
  assert.match(build, /replaceAll\('\{\{ASSET_VERSION\}\}', assetVersion\)/);
  assert.match(build, /score-engine\.js\?v=\$\{assetVersion\}/);
  assert.match(build, /assetSourcePaths/);
  assert.match(build, /'src\/styles\.css'/);
  assert.match(build, /asset_source_sha256/);

  assert.match(css, /@page \{ size: A4 portrait; margin: 12mm; \}/);
  assert.match(css, /\.song-directory/);
  assert.match(css, /\.library-song \{ display: none !important; \}/);
  assert.match(css, /\.library-song\.print-selected/);
  assert.match(css, /\.print-selected \.score-header \{[\s\S]*width: var\(--staff-width, 700px\);[\s\S]*margin-inline: auto;/);
  assert.match(css, /page-break-inside: avoid/);
  assert.match(css, /#studio-view/);
  assert.doesNotMatch(css, /quarantine-panel/);
});
