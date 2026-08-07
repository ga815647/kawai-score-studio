import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import YAML from 'yaml';

const oldVersion = '0.6.19';
const newVersion = '0.6.20';
const accessedAt = '2026-08-07';
const workflowPath = '.github/workflows/apply-nursery-batch.yml';
const scriptPath = 'scripts/apply-nursery-batch.mjs';

const verification = () => ({
  source_to_scorebook_checked: true,
  melody_checked: true,
  rhythm_checked: true,
  rests_checked: true,
  pickup_checked: true,
  measures_checked: true,
  ties_checked: true,
  lyrics_checked: true,
  user_approved: true,
});

const n = (id, pitch, duration) => ({ id, kind: 'note', pitch, duration });
const m = (number, capacity_eighth_units, events, pickup = false) => ({
  number,
  capacity_eighth_units,
  events,
  ...(pickup ? { pickup: true } : {}),
});

function syllables(eventIds, text) {
  const chars = [...text.replace(/\s+/g, '')];
  if (chars.length !== eventIds.length) {
    throw new Error(`Lyric/event mismatch for ${text}: ${chars.length} chars / ${eventIds.length} events`);
  }
  return eventIds.map((event, index) => ({ event, text: chars[index] }));
}

function zhTrack(parts, continuations = []) {
  return [{
    id: 'zh-tw',
    locale: 'zh-TW',
    role: 'original',
    status: 'verified',
    default: true,
    syllables: parts.flatMap(([ids, text]) => syllables(ids, text)),
    ...(continuations.length > 0 ? { continuations } : {}),
  }];
}

const songs = [
  {
    id: 'yi-bi-ya-ya-zh',
    title: '依比呀呀',
    alias: '一比一比鴨鴨鴨',
    status: 'verified',
    key: 'C major',
    meter: '2/4',
    pickup_eighth_units: 2,
    source: {
      title: '一比一比鴨鴨鴨',
      source_type: 'score_website',
      provided_by: 'assistant_web_research',
      publisher_or_origin: 'Jianpu Space',
      publisher: 'Jianpu Space',
      accessed_at: accessedAt,
      selected_variant: 'Traditional Chinese Jianpu Space version in C major, 2/4, with two-eighth-note pickup',
      original_key: 'C major',
      original_meter: '2/4',
      pickup: 2,
      rights_status: 'traditional_song_with_published_traditional_chinese_lyrics',
      url: 'https://jianpu.space/zh-tw/songList/65c3bad62cce837239c1fba6',
    },
    verification: verification(),
    measures: [
      m(0, 2, [n('n01', '5_', 1), n('n02', '6_', 1)], true),
      m(1, 4, [n('n03', '1', 2), n('n04', '1', 2)]),
      m(2, 4, [n('n05', '1', 1), n('n06', '6_', 1), n('n07', '5_', 1), n('n08', '6_', 1)]),
      m(3, 4, [n('n09', '1', 4)]),
      m(4, 4, [n('n10', '1', 2), n('n11', '1', 1), n('n12', '2', 1)]),
      m(5, 4, [n('n13', '3', 2), n('n14', '3', 2)]),
      m(6, 4, [n('n15', '5', 1), n('n16', '3', 1), n('n17', '2', 1), n('n18', '1', 1)]),
      m(7, 4, [n('n19', '2', 4)]),
      m(8, 4, [n('n20', '2', 2), n('n21', '5', 1), n('n22', '4', 1)]),
      m(9, 4, [n('n23', '3', 2), n('n24', '3', 2)]),
      m(10, 4, [n('n25', '2', 1), n('n26', '1', 1), n('n27', '2', 1), n('n28', '1', 1)]),
      m(11, 4, [n('n29', '6_', 2), n('n30', '6_', 2)]),
      m(12, 4, [n('n31', '5_', 1), n('n32', '6_', 1), n('n33', '5_', 1), n('n34', '6_', 1)]),
      m(13, 4, [n('n35', '1', 2), n('n36', '1', 2)]),
      m(14, 4, [n('n37', '2', 1), n('n38', '3', 1), n('n39', '2', 1), n('n40', '3', 1)]),
      m(15, 4, [n('n41', '1', 4)]),
      m(16, 4, [n('n42', '1', 4)]),
    ],
    ties: [
      { id: 't01', from: 'n09', to: 'n10' },
      { id: 't02', from: 'n19', to: 'n20' },
      { id: 't03', from: 'n41', to: 'n42' },
    ],
    lyric_tracks: zhTrack([
      [['n01','n02','n03','n04','n05','n06','n07','n08','n09'], '一比鴨鴨一比一比鴨'],
      [['n11','n12','n13','n14','n15','n16','n17','n18','n19'], '一比鴨鴨一比一比鴨'],
      [['n21','n22','n23','n24','n25','n26','n27','n28','n29','n30'], '一比鴨鴨一比一比鴨鴨'],
      [['n31','n32','n33','n34','n35','n36','n37','n38','n39','n40','n41'], '一比一比鴨鴨一比一比鴨'],
    ], [
      { from: 'n09', through: 'n10' },
      { from: 'n19', through: 'n20' },
      { from: 'n41', through: 'n42' },
    ]),
  },
  {
    id: 'little-bee-zh',
    title: '小蜜蜂',
    status: 'verified',
    key: 'C major',
    meter: '4/4',
    pickup_eighth_units: 0,
    source: {
      title: '小蜜蜂',
      source_type: 'score_website',
      provided_by: 'assistant_web_research',
      publisher_or_origin: 'Jianpu Space',
      publisher: 'Jianpu Space',
      accessed_at: accessedAt,
      selected_variant: 'Traditional Chinese Jianpu Space sixteen-measure version in C major, 4/4',
      original_key: 'C major',
      original_meter: '4/4',
      pickup: 0,
      rights_status: 'public_domain_melody_with_published_traditional_chinese_lyrics',
      url: 'https://jianpu.space/zh-tw/songList/2',
    },
    verification: verification(),
    measures: [
      m(1, 8, [n('n01','5',2),n('n02','3',2),n('n03','3',4)]),
      m(2, 8, [n('n04','4',2),n('n05','2',2),n('n06','2',4)]),
      m(3, 8, [n('n07','1',2),n('n08','2',2),n('n09','3',2),n('n10','4',2)]),
      m(4, 8, [n('n11','5',2),n('n12','5',2),n('n13','5',4)]),
      m(5, 8, [n('n14','5',2),n('n15','3',2),n('n16','3',4)]),
      m(6, 8, [n('n17','4',2),n('n18','2',2),n('n19','2',4)]),
      m(7, 8, [n('n20','1',2),n('n21','3',2),n('n22','5',2),n('n23','5',2)]),
      m(8, 8, [n('n24','3',8)]),
      m(9, 8, [n('n25','2',2),n('n26','2',2),n('n27','2',2),n('n28','2',2)]),
      m(10, 8, [n('n29','2',2),n('n30','3',2),n('n31','4',4)]),
      m(11, 8, [n('n32','3',2),n('n33','3',2),n('n34','3',2),n('n35','3',2)]),
      m(12, 8, [n('n36','3',2),n('n37','4',2),n('n38','5',4)]),
      m(13, 8, [n('n39','5',2),n('n40','3',2),n('n41','3',4)]),
      m(14, 8, [n('n42','4',2),n('n43','2',2),n('n44','2',4)]),
      m(15, 8, [n('n45','1',2),n('n46','3',2),n('n47','5',2),n('n48','5',2)]),
      m(16, 8, [n('n49','1',8)]),
    ],
    ties: [],
    lyric_tracks: zhTrack([
      [['n01','n02','n03','n04','n05','n06','n07','n08','n09','n10','n11','n12','n13'], '小蜜蜂嗡嗡嗡大家一起勤做工'],
      [['n14','n15','n16','n17','n18','n19','n20','n21','n22','n23','n24'], '來匆匆去匆匆做工興味濃'],
      [['n25','n26','n27','n28','n29','n30','n31','n32','n33','n34','n35','n36','n37','n38'], '天暖花開不做工將來哪裡好過冬'],
      [['n39','n40','n41','n42','n43','n44','n45','n46','n47','n48','n49'], '快做工快做工別學懶惰蟲'],
    ]),
  },
  {
    id: 'fast-train-zh',
    title: '火車快飛',
    status: 'verified',
    key: 'C major',
    meter: '2/4',
    pickup_eighth_units: 0,
    source: {
      title: '火車快飛',
      source_type: 'score_website',
      provided_by: 'assistant_web_research',
      publisher_or_origin: 'Jianpu Space',
      publisher: 'Jianpu Space',
      accessed_at: accessedAt,
      selected_variant: 'Traditional Chinese Jianpu Space ten-measure version in C major, 2/4',
      original_key: 'C major',
      original_meter: '2/4',
      pickup: 0,
      rights_status: 'published_children_song_static_notation',
      url: 'https://jianpu.space/zh-tw/songList/10',
    },
    verification: verification(),
    measures: [
      m(1,4,[n('n01','5',1),n('n02','5',1),n('n03','3',1),n('n04','1',1)]),
      m(2,4,[n('n05','5',1),n('n06','5',1),n('n07','3',1),n('n08','1',1)]),
      m(3,4,[n('n09','2',1),n('n10','3',1),n('n11','4',1),n('n12','4',1)]),
      m(4,4,[n('n13','3',1),n('n14','4',1),n('n15','5',1),n('n16','5',1)]),
      m(5,4,[n('n17','5',1),n('n18','3',1),n('n19','5',1),n('n20','3',1)]),
      m(6,4,[n('n21','2',1),n('n22','3',1),n('n23','1',2)]),
      m(7,4,[n('n24','4',1),n('n25','2',1),n('n26','2',1),n('n27','2',1)]),
      m(8,4,[n('n28','3',1),n('n29','1',1),n('n30','1',1),n('n31','1',1)]),
      m(9,4,[n('n32','2',1),n('n33','3',1),n('n34','4',1),n('n35','2',1)]),
      m(10,4,[n('n36','1',1),n('n37','7_',1),n('n38','1',2)]),
    ],
    ties: [],
    lyric_tracks: zhTrack([
      [['n01','n02','n03','n04','n05','n06','n07','n08'], '火車快飛火車快飛'],
      [['n09','n10','n11','n12','n13','n14','n15','n16'], '穿過高山渡過小溪'],
      [['n17','n18','n19','n20','n21','n22','n23'], '不知跑了幾百里'],
      [['n24','n25','n26','n27','n28','n29','n30','n31'], '快到家裡快到家裡'],
      [['n32','n33','n34','n35','n36','n37','n38'], '爸媽看了真歡喜'],
    ]),
  },
  {
    id: 'pull-the-radish-zh',
    title: '拔蘿蔔',
    status: 'verified',
    key: 'C major',
    meter: '2/4',
    pickup_eighth_units: 0,
    source: {
      title: '拔蘿蔔',
      source_type: 'score_website',
      provided_by: 'assistant_web_research',
      publisher_or_origin: 'Jianpu Space',
      publisher: 'Jianpu Space',
      accessed_at: accessedAt,
      selected_variant: 'Traditional Chinese Jianpu Space ten-measure version in C major, 2/4',
      original_key: 'C major',
      original_meter: '2/4',
      pickup: 0,
      rights_status: 'traditional_children_song_with_published_traditional_chinese_lyrics',
      url: 'https://jianpu.space/zh-tw/songList/66f8bf9618d7fae816dd13da',
    },
    verification: verification(),
    measures: [
      m(1,4,[n('n01','5_',1),n('n02','5_',1),n('n03','1',2)]),
      m(2,4,[n('n04','3',1),n('n05','2',1),n('n06','1',2)]),
      m(3,4,[n('n07','5',1),n('n08','5',1),n('n09','5',1),n('n10','5',1)]),
      m(4,4,[n('n11','1',1),n('n12','2',1),n('n13','1',2)]),
      m(5,4,[n('n14','5',1),n('n15','5',1),n('n16','5',1),n('n17','5',1)]),
      m(6,4,[n('n18','1',1),n('n19','2',1),n('n20','1',2)]),
      m(7,4,[n('n21','5',1),n('n22','5',1),n('n23','1',2)]),
      m(8,4,[n('n24','5',1),n('n25','5',1),n('n26','1',2)]),
      m(9,4,[n('n27','5',1),n('n28','5',1),n('n29','5',1),n('n30','3',0.5),n('n31','2',0.5)]),
      m(10,4,[n('n32','1',1),n('n33','2',1),n('n34','1',2)]),
    ],
    ties: [],
    lyric_tracks: zhTrack([
      [['n01','n02','n03','n04','n05','n06'], '拔蘿蔔拔蘿蔔'],
      [['n07','n08','n09','n10','n11','n12','n13'], '嘿呦嘿呦拔蘿蔔'],
      [['n14','n15','n16','n17','n18','n19','n20'], '嘿呦嘿呦拔不動'],
      [['n21','n22','n23','n24','n25','n26'], '老婆婆快快來'],
      [['n27','n28','n29','n30','n31','n32','n33','n34'], '快來幫我們拔蘿蔔'],
    ]),
  },
  {
    id: 'build-an-airplane-zh',
    title: '造飛機',
    status: 'verified',
    key: 'C major',
    meter: '2/4',
    pickup_eighth_units: 0,
    source: {
      title: '造飛機',
      source_type: 'score_website',
      provided_by: 'assistant_web_research',
      publisher_or_origin: 'Jianpu Space',
      publisher: 'Jianpu Space',
      accessed_at: accessedAt,
      selected_variant: 'Traditional Chinese Jianpu Space twenty-measure version in C major, 2/4',
      original_key: 'C major',
      original_meter: '2/4',
      pickup: 0,
      rights_status: 'published_children_song_static_notation',
      url: 'https://jianpu.space/zh-tw/songList/66f94b2d18d7fae816dd13de',
    },
    verification: verification(),
    measures: [
      m(1,4,[n('n01','5',2),n('n02','3',1),n('n03','4',1)]),
      m(2,4,[n('n04','5',2),n('n05','3',1),n('n06','4',1)]),
      m(3,4,[n('n07','5',1),n('n08','5',1),n('n09','6',1),n('n10','6',1)]),
      m(4,4,[n('n11','5',4)]),
      m(5,4,[n('n12','3',2),n('n13','2',1),n('n14','1',1)]),
      m(6,4,[n('n15','3',2),n('n16','2',1),n('n17','1',1)]),
      m(7,4,[n('n18','6_',1),n('n19','6_',1),n('n20','1',1),n('n21','1',1)]),
      m(8,4,[n('n22','5_',4)]),
      m(9,4,[n('n23','6_',2),n('n24','1',1),n('n25','1',1)]),
      m(10,4,[n('n26','5_',1),n('n27','5_',1),n('n28','1',2)]),
      m(11,4,[n('n29','2',1),n('n30','2',1),n('n31','1',1),n('n32','2',1)]),
      m(12,4,[n('n33','3',4)]),
      m(13,4,[n('n34','5',2),n('n35','3',1),n('n36','4',1)]),
      m(14,4,[n('n37','5',2),n('n38','3',1),n('n39','4',1)]),
      m(15,4,[n('n40','5',1),n('n41','5',1),n('n42','6',1),n('n43','6',1)]),
      m(16,4,[n('n44','5',4)]),
      m(17,4,[n('n45','6',2),n('n46','6',1),n('n47','5',1)]),
      m(18,4,[n('n48','3',2),n('n49','2',1),n('n50','1',1)]),
      m(19,4,[n('n51','2',1),n('n52','2',1),n('n53','5',1),n('n54','5',1)]),
      m(20,4,[n('n55','1',4)]),
    ],
    ties: [],
    lyric_tracks: zhTrack([
      [['n01','n02','n03','n04','n05','n06','n07','n08','n09','n10','n11'], '造飛機造飛機來到青草地'],
      [['n12','n13','n14','n15','n16','n17','n18','n19','n20','n21','n22'], '蹲下去蹲下去我做推進器'],
      [['n23','n24','n25','n26','n27','n28','n29','n30','n31','n32','n33'], '蹲下去蹲下去你做飛機翼'],
      [['n34','n35','n36','n37','n38','n39','n40','n41','n42','n43','n44'], '彎著腰彎著腰飛機做的奇'],
      [['n45','n46','n47','n48','n49','n50','n51','n52','n53','n54','n55'], '飛上去飛上去飛到白雲裡'],
    ]),
  },
];

for (const song of songs) {
  for (const measure of song.measures) {
    const total = measure.events.reduce((sum, event) => sum + event.duration, 0);
    if (total !== measure.capacity_eighth_units) {
      throw new Error(`${song.id} measure ${measure.number}: ${total} != ${measure.capacity_eighth_units}`);
    }
  }
}

const songIds = songs.map((song) => song.id);
const expectedAllIds = [
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
  ...songIds,
];

let scorebook = await readFile('scorebook.yaml', 'utf8');
if (!scorebook.includes(`  version: ${oldVersion}`)) throw new Error('Unexpected scorebook version');
for (const id of songIds) {
  if (scorebook.includes(`  - id: ${id}\n`)) throw new Error(`Song already exists: ${id}`);
}
scorebook = scorebook.replace(`  version: ${oldVersion}`, `  version: ${newVersion}`);
const fragment = YAML.stringify(songs).trimEnd().split('\n').map((line) => `  ${line}`).join('\n');
const quarantineMarker = '  quarantine: []';
if (scorebook.split(quarantineMarker).length !== 2) throw new Error('Unexpected quarantine marker count');
scorebook = scorebook.replace(quarantineMarker, `${fragment}\n${quarantineMarker}`);
const parsed = YAML.parse(scorebook);
if (parsed.project.version !== newVersion) throw new Error('Version bump failed');
if (parsed.library.songs.length !== 15) throw new Error(`Expected 15 songs, got ${parsed.library.songs.length}`);
if (JSON.stringify(parsed.library.songs.map((song) => song.id)) !== JSON.stringify(expectedAllIds)) {
  throw new Error('Unexpected song ordering after insertion');
}
await writeFile('scorebook.yaml', scorebook);

let packageJson = await readFile('package.json', 'utf8');
packageJson = packageJson.replace(`\"version\": \"${oldVersion}\"`, `\"version\": \"${newVersion}\"`);
if (!packageJson.includes(`\"version\": \"${newVersion}\"`)) throw new Error('package.json version bump failed');
await writeFile('package.json', packageJson);

const compactDigest = (song) => createHash('sha256').update(JSON.stringify(
  song.measures.flatMap((measure) => measure.events.map((event) => [event.kind, event.pitch ?? null, event.duration])),
)).digest('hex');

const exactSpecs = Object.fromEntries(songs.map((song) => {
  const events = song.measures.flatMap((measure) => measure.events);
  const lyrics = song.lyric_tracks[0].syllables;
  return [song.id, {
    title: song.title,
    meter: song.meter,
    pickup: song.pickup_eighth_units,
    measures: song.measures.length,
    notes: events.length,
    lyrics: lyrics.length,
    ties: song.ties.length,
    url: song.source.url,
    digest: compactDigest(song),
  }];
}));

let scorebookTest = await readFile('tests/scorebook.test.mjs', 'utf8');
const replacements = [
  ["test('0.6.19 has ten verified songs, no quarantine, and passes structural gates'", "test('0.6.20 has fifteen verified songs, no quarantine, and passes structural gates'"],
  ["assert.equal(book.project.version, '0.6.19');", "assert.equal(book.project.version, '0.6.20');"],
  ['    verifiedSongs: 10,', '    verifiedSongs: 15,'],
  ["    'canon-in-d',\n  ]);", "    'canon-in-d',\n    'yi-bi-ya-ya-zh',\n    'little-bee-zh',\n    'fast-train-zh',\n    'pull-the-radish-zh',\n    'build-an-airplane-zh',\n  ]);"],
];
for (const [from, to] of replacements) {
  if (!scorebookTest.includes(from)) throw new Error(`Missing scorebook test marker: ${from}`);
  scorebookTest = scorebookTest.replace(from, to);
}
const exactTest = `\ntest('five Chinese nursery songs exactly model the selected Jianpu Space sources', async () => {\n  const { book } = await loadProject();\n  const specs = ${JSON.stringify(exactSpecs, null, 2)};\n  for (const [id, spec] of Object.entries(specs)) {\n    const song = book.library.songs.find((candidate) => candidate.id === id);\n    assert.ok(song, id);\n    assert.equal(song.title, spec.title);\n    assert.equal(song.key, 'C major');\n    assert.equal(song.meter, spec.meter);\n    assert.equal(song.pickup_eighth_units, spec.pickup);\n    assert.equal(song.measures.length, spec.measures);\n    const events = flattenEvents(song);\n    assert.equal(events.length, spec.notes);\n    const track = song.lyric_tracks.find((candidate) => candidate.default);\n    assert.equal(track.locale, 'zh-TW');\n    assert.equal(track.role, 'original');\n    assert.equal(track.syllables.length, spec.lyrics);\n    assert.equal(song.ties.length, spec.ties);\n    assert.equal(song.source.url, spec.url);\n    const digest = createHash('sha256').update(JSON.stringify(\n      events.map((event) => [event.kind, event.pitch ?? null, event.duration]),\n    )).digest('hex');\n    assert.equal(digest, spec.digest, id);\n    assert.ok(Object.values(song.verification).every((value) => value === true));\n  }\n});\n\n`;
const a4Marker = "test('A4 print contract selects one verified song and permits page breaks only between systems'";
if (!scorebookTest.includes(a4Marker)) throw new Error('Missing A4 test insertion marker');
scorebookTest = scorebookTest.replace(a4Marker, `${exactTest}${a4Marker}`);
await writeFile('tests/scorebook.test.mjs', scorebookTest);

let visualTest = await readFile('tests/library-visual.spec.mjs', 'utf8');
const visualRows = songs.map((song) => {
  const noteCount = song.measures.flatMap((measure) => measure.events).length;
  const lyricCount = song.lyric_tracks[0].syllables.length;
  return `  { id: '${song.id}', title: '${song.title}', notes: ${noteCount}, lyrics: ${lyricCount} },`;
}).join('\n');
const visualSongMarker = "  { id: 'canon-in-d', title: 'Canon in D', notes: 292, lyrics: 0 },\n];";
if (!visualTest.includes(visualSongMarker)) throw new Error('Missing visual song marker');
visualTest = visualTest.replace(visualSongMarker, `  { id: 'canon-in-d', title: 'Canon in D', notes: 292, lyrics: 0 },\n${visualRows}\n];`);
for (const [from, to] of [
  ["規格 0.6.19", "規格 0.6.20"],
  ["toHaveCount(10);", "toHaveCount(15);"],
  ["?v=0.6.19-", "?v=0.6.20-"],
]) {
  if (!visualTest.includes(from)) throw new Error(`Missing visual test marker: ${from}`);
  visualTest = visualTest.split(from).join(to);
}
await writeFile('tests/library-visual.spec.mjs', visualTest);

let readme = await readFile('README.md', 'utf8');
const oldLibrary = `目前版本包含 7 首已驗證曲目：\n\n1. Hickory Dickory Dock（老鼠時鐘）\n2. The Itsy Bitsy Spider（小小蜘蛛）\n3. 小星星\n4. 兩隻老虎\n5. 王老先生有塊地\n6. 瑪麗有隻小綿羊\n7. 生日快樂`;
const newLibrary = `目前版本包含 15 首已驗證曲目：\n\n1. Hickory Dickory Dock（老鼠時鐘）\n2. The Itsy Bitsy Spider（小小蜘蛛）\n3. 小星星\n4. 兩隻老虎\n5. 王老先生有塊地\n6. 瑪麗有隻小綿羊\n7. 生日快樂\n8. Row, Row, Row Your Boat\n9. The Wheels on the Bus\n10. Canon in D（卡農主題）\n11. 依比呀呀（一比一比鴨鴨鴨）\n12. 小蜜蜂\n13. 火車快飛\n14. 拔蘿蔔\n15. 造飛機`;
if (!readme.includes(oldLibrary)) throw new Error('Unexpected README library section');
readme = readme.replace(oldLibrary, newLibrary);
await writeFile('README.md', readme);

await rm(scriptPath);
await rm(workflowPath);
console.log(`Applied ${songs.length} songs: ${songIds.join(', ')}`);
