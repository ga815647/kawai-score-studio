import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('0.6.15 has seven verified songs, no quarantine, and passes structural gates', async () => {
  const { book, fixtures } = await loadProject();
  const result = validateProject(book, fixtures);
  assert.equal(result.pass, true, JSON.stringify(result.errors, null, 2));
  assert.equal(book.project.version, '0.6.15');
  assert.deepEqual(result.counts, {
    verifiedSongs: 7,
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

test('A4 print contract selects one verified song and permits page breaks only between systems', async () => {
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

  assert.match(css, /@page \{ size: A4 portrait; margin: 12mm; \}/);
  assert.match(css, /\.song-directory/);
  assert.match(css, /\.library-song \{ display: none !important; \}/);
  assert.match(css, /\.library-song\.print-selected/);
  assert.match(css, /page-break-inside: avoid/);
  assert.match(css, /#studio-view/);
  assert.doesNotMatch(css, /quarantine-panel/);
});
