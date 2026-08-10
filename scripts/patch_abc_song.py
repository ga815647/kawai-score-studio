from pathlib import Path

SONG_BLOCK = r'''  - id: abc-song
    title: ABC Song
    alias: Alphabet Song
    status: verified
    difficulty: 2
    key: C major
    meter: 4/4
    pickup_eighth_units: 0
    source:
      title: Alphabet Song - ABC's
      source_type: score_pdf
      provided_by: assistant_web_research
      publisher_or_origin: Piano Song Download
      publisher: Piano Song Download
      accessed_at: '2026-08-10'
      selected_variant: English alphabet lyrics in C major, 4/4 lead sheet
      original_key: C major
      original_meter: 4/4
      pickup: 0
      rights_status: traditional_song_with_2016_arrangement_copyright
      url: https://www.pianosongdownload.com/Alphabet%20Song%20Lead%20Sheet.pdf
    verification:
      source_to_scorebook_checked: true
      melody_checked: true
      rhythm_checked: true
      rests_checked: true
      pickup_checked: true
      measures_checked: true
      ties_checked: true
      lyrics_checked: true
      user_approved: true
    measures:
    - number: 1
      capacity_eighth_units: 8
      events:
      - id: n01
        kind: note
        pitch: '1'
        duration: 2
      - id: n02
        kind: note
        pitch: '1'
        duration: 2
      - id: n03
        kind: note
        pitch: '5'
        duration: 2
      - id: n04
        kind: note
        pitch: '5'
        duration: 2
    - number: 2
      capacity_eighth_units: 8
      events:
      - id: n05
        kind: note
        pitch: '6'
        duration: 2
      - id: n06
        kind: note
        pitch: '6'
        duration: 2
      - id: n07
        kind: note
        pitch: '5'
        duration: 4
    - number: 3
      capacity_eighth_units: 8
      events:
      - id: n08
        kind: note
        pitch: '4'
        duration: 2
      - id: n09
        kind: note
        pitch: '4'
        duration: 2
      - id: n10
        kind: note
        pitch: '3'
        duration: 2
      - id: n11
        kind: note
        pitch: '3'
        duration: 2
    - number: 4
      capacity_eighth_units: 8
      events:
      - id: n12
        kind: note
        pitch: '2'
        duration: 1
      - id: n13
        kind: note
        pitch: '2'
        duration: 1
      - id: n14
        kind: note
        pitch: '2'
        duration: 1
      - id: n15
        kind: note
        pitch: '2'
        duration: 1
      - id: n16
        kind: note
        pitch: '1'
        duration: 4
    - number: 5
      capacity_eighth_units: 8
      events:
      - id: n17
        kind: note
        pitch: '5'
        duration: 2
      - id: n18
        kind: note
        pitch: '5'
        duration: 2
      - id: n19
        kind: note
        pitch: '4'
        duration: 4
    - number: 6
      capacity_eighth_units: 8
      events:
      - id: n20
        kind: note
        pitch: '3'
        duration: 2
      - id: n21
        kind: note
        pitch: '3'
        duration: 2
      - id: n22
        kind: note
        pitch: '2'
        duration: 4
    - number: 7
      capacity_eighth_units: 8
      events:
      - id: n23
        kind: note
        pitch: '5'
        duration: 1
      - id: n24
        kind: note
        pitch: '5'
        duration: 1
      - id: n25
        kind: note
        pitch: '5'
        duration: 2
      - id: n26
        kind: note
        pitch: '4'
        duration: 4
    - number: 8
      capacity_eighth_units: 8
      events:
      - id: n27
        kind: note
        pitch: '3'
        duration: 2
      - id: n28
        kind: note
        pitch: '3'
        duration: 2
      - id: n29
        kind: note
        pitch: '2'
        duration: 4
    - number: 9
      capacity_eighth_units: 8
      events:
      - id: n30
        kind: note
        pitch: '1'
        duration: 2
      - id: n31
        kind: note
        pitch: '1'
        duration: 2
      - id: n32
        kind: note
        pitch: '5'
        duration: 2
      - id: n33
        kind: note
        pitch: '5'
        duration: 2
    - number: 10
      capacity_eighth_units: 8
      events:
      - id: n34
        kind: note
        pitch: '6'
        duration: 2
      - id: n35
        kind: note
        pitch: '6'
        duration: 2
      - id: n36
        kind: note
        pitch: '5'
        duration: 4
    - number: 11
      capacity_eighth_units: 8
      events:
      - id: n37
        kind: note
        pitch: '4'
        duration: 2
      - id: n38
        kind: note
        pitch: '4'
        duration: 2
      - id: n39
        kind: note
        pitch: '3'
        duration: 2
      - id: n40
        kind: note
        pitch: '3'
        duration: 2
    - number: 12
      capacity_eighth_units: 8
      events:
      - id: n41
        kind: note
        pitch: '2'
        duration: 2
      - id: n42
        kind: note
        pitch: '2'
        duration: 2
      - id: n43
        kind: note
        pitch: '1'
        duration: 4
    ties: []
    lyric_tracks:
    - id: en
      locale: en
      role: original
      status: verified
      default: true
      syllables:
      - event: n01
        text: 'A'
      - event: n02
        text: 'B'
      - event: n03
        text: 'C'
      - event: n04
        text: 'D'
      - event: n05
        text: 'E'
      - event: n06
        text: 'F'
      - event: n07
        text: 'G'
      - event: n08
        text: 'H'
      - event: n09
        text: 'I'
      - event: n10
        text: 'J'
      - event: n11
        text: 'K'
      - event: n12
        text: 'L'
      - event: n13
        text: 'M'
      - event: n14
        text: 'N'
      - event: n15
        text: 'O'
      - event: n16
        text: 'P'
      - event: n17
        text: 'Q'
      - event: n18
        text: 'R'
      - event: n19
        text: 'S'
      - event: n20
        text: 'T'
      - event: n21
        text: 'U'
      - event: n22
        text: 'V'
      - event: n23
        text: 'Dou-'
      - event: n24
        text: 'ble'
      - event: n25
        text: 'u'
      - event: n26
        text: 'X'
      - event: n27
        text: 'Y'
      - event: n28
        text: 'and'
      - event: n29
        text: 'Z.'
      - event: n30
        text: 'Now'
      - event: n31
        text: 'I'
      - event: n32
        text: 'know'
      - event: n33
        text: 'my'
      - event: n34
        text: 'A'
      - event: n35
        text: 'B'
      - event: n36
        text: 'C''s.'
      - event: n37
        text: 'Next'
      - event: n38
        text: 'time'
      - event: n39
        text: 'won''t'
      - event: n40
        text: 'you'
      - event: n41
        text: 'sing'
      - event: n42
        text: 'with'
      - event: n43
        text: 'me!'
'''

TEST_BLOCK = r'''

test('0.6.30 ABC Song exactly models the selected fixed static PDF score', async () => {
  const { book } = await loadProject();
  const song = book.library.songs.find((candidate) => candidate.id === 'abc-song');
  assert.ok(song, 'abc-song must exist');
  assert.equal(song.title, 'ABC Song');
  assert.equal(song.alias, 'Alphabet Song');
  assert.equal(song.status, 'verified');
  assert.equal(song.difficulty, 2);
  assert.equal(song.key, 'C major');
  assert.equal(song.meter, '4/4');
  assert.equal(song.pickup_eighth_units, 0);
  assert.equal(song.measures.length, 12);
  assert.equal(song.source.source_type, 'score_pdf');
  assert.equal(song.source.provided_by, 'assistant_web_research');
  assert.equal(
    song.source.url,
    'https://www.pianosongdownload.com/Alphabet%20Song%20Lead%20Sheet.pdf',
  );

  const events = flattenEvents(song);
  assert.equal(events.filter((event) => event.kind === 'note').length, 43);
  assert.equal(events.filter((event) => event.kind === 'rest').length, 0);
  assert.deepEqual(song.ties, []);
  const track = song.lyric_tracks.find((candidate) => candidate.default);
  assert.ok(track);
  assert.equal(track.locale, 'en');
  assert.equal(track.role, 'original');
  assert.equal(track.syllables.length, 43);
  assert.equal(track.syllables[22].text, 'Dou-');
  assert.equal(track.syllables[23].text, 'ble');
  assert.equal(track.syllables[24].text, 'u');

  assert.deepEqual(
    song.measures[3].events.map((event) => [event.pitch, event.duration]),
    [['2', 1], ['2', 1], ['2', 1], ['2', 1], ['1', 4]],
  );
  assert.deepEqual(
    song.measures[6].events.map((event) => [event.pitch, event.duration]),
    [['5', 1], ['5', 1], ['5', 2], ['4', 4]],
  );

  const compactMeasures = song.measures.map((measure) =>
    measure.events.map((event) => [event.pitch ?? null, event.duration]));
  const digest = createHash('sha256').update(JSON.stringify(compactMeasures)).digest('hex');
  assert.equal(
    digest,
    '550002b7d5210f1a490306dcd1834da055127c744e344cb50626b6c935ec2fc0',
  );
  assert.ok(Object.values(song.verification).every((value) => value === true));
});
'''

def read(path):
    return Path(path).read_text(encoding='utf-8')

def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

scorebook = read('scorebook.yaml')
scorebook = replace_once(scorebook, '  version: 0.6.29\n', '  version: 0.6.30\n', 'scorebook version')
scorebook = replace_once(
    scorebook,
    '  quarantine: []\nworkflow:',
    SONG_BLOCK + '  quarantine: []\nworkflow:',
    'scorebook song insertion',
)
write('scorebook.yaml', scorebook)

package = read('package.json')
package = replace_once(
    package,
    '  "version": "0.6.29",',
    '  "version": "0.6.30",',
    'package version',
)
write('package.json', package)

score_test = read('tests/scorebook.test.mjs')
score_test = replace_once(
    score_test,
    "test('0.6.29 has fifty verified songs, no quarantine, and passes structural gates'",
    "test('0.6.30 has fifty-one verified songs, no quarantine, and passes structural gates'",
    'scorebook test title',
)
score_test = replace_once(
    score_test,
    "assert.equal(book.project.version, '0.6.29');",
    "assert.equal(book.project.version, '0.6.30');",
    'scorebook test version',
)
score_test = replace_once(
    score_test,
    '    verifiedSongs: 50,',
    '    verifiedSongs: 51,',
    'scorebook test verified count',
)
score_test = replace_once(
    score_test,
    "    'do-your-ears-hang-low',\n  ]);",
    "    'do-your-ears-hang-low',\n    'abc-song',\n  ]);",
    'scorebook id list',
)
if "0.6.30 ABC Song exactly models" in score_test:
    raise RuntimeError('ABC Song score test already present')
score_test = score_test.rstrip() + TEST_BLOCK + '\n'
write('tests/scorebook.test.mjs', score_test)

difficulty = read('tests/difficulty.test.mjs')
difficulty = replace_once(
    difficulty,
    '// Includes the verified 0.6.29 five-song static-source batch.',
    '// Includes the verified 0.6.29 five-song static-source batch plus ABC Song.',
    'difficulty comment',
)
difficulty = replace_once(
    difficulty,
    '  assert.equal(book.library.songs.length, 50);',
    '  assert.equal(book.library.songs.length, 51);',
    'difficulty song count',
)
write('tests/difficulty.test.mjs', difficulty)

visual = read('tests/library-visual.spec.mjs')
visual = replace_once(
    visual,
    "  { id: 'do-your-ears-hang-low', title: 'Do Your Ears Hang Low?', notes: 47, lyrics: 47 },\n];",
    "  { id: 'do-your-ears-hang-low', title: 'Do Your Ears Hang Low?', notes: 47, lyrics: 47 },\n"
    "  { id: 'abc-song', title: 'ABC Song', notes: 43, lyrics: 43 },\n];",
    'visual song list',
)
visual = replace_once(
    visual,
    "toContainText('規格 0.6.29');",
    "toContainText('規格 0.6.30');",
    'visual status version',
)
asset_count = visual.count('?v=0.6.29-')
if asset_count != 2:
    raise RuntimeError(f'visual asset version: expected two matches, found {asset_count}')
visual = visual.replace('?v=0.6.29-', '?v=0.6.30-')
count_50 = visual.count('toHaveCount(50);')
if count_50 != 2:
    raise RuntimeError(f'visual song count: expected two matches, found {count_50}')
visual = visual.replace('toHaveCount(50);', 'toHaveCount(51);')
write('tests/library-visual.spec.mjs', visual)
