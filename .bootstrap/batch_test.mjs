test('five-song Muffin/Farmer/Rosie/doll/mouse batch exactly matches fixed static sources', async () => {
  const { book } = await loadProject();
  const specs = {
    'the-muffin-man': {
      title: 'The Muffin Man',
      difficulty: 2,
      meter: '4/4',
      pickup: 0,
      notes: 28,
      lyrics: 28,
      digest: '15745aeabbf145b25c38b5a0a314c03064a76b4e58644e87ba05cafafd8971df',
      url: 'https://pianocoda.com/kids-songs/the-muffin-man/',
    },
    'the-farmer-in-the-dell': {
      title: 'The Farmer in the Dell',
      difficulty: 3,
      meter: '6/8',
      pickup: 1,
      notes: 25,
      lyrics: 24,
      digest: '64709ae11e808b7170cc5be70926a7e1eb3510305f8412c1c840843bf68afea2',
      url: 'https://abcnotation.com/tunePage?a=trillian.mit.edu%2F~jc%2Fmusic%2Fabc%2Fmirror%2Fgulfweb.net%3A34043%2F~rlwalker%2Fabc%2Ffarmer%2F0000',
    },
    'ring-around-the-rosie': {
      title: 'Ring Around the Rosie',
      difficulty: 2,
      meter: '6/8',
      pickup: 0,
      notes: 21,
      lyrics: 21,
      digest: 'c4912b0fc1a3f7db5f5c90d4c130c3387a2cfecb168dfe8a631fd7f579cae6c4',
      url: 'https://www.bethsnotesplus.com/wp-content/uploads/2016/11/Ring-Around-the-Rosie-1.webp',
    },
    'little-sister-carries-doll-zh': {
      title: '妹妹背著洋娃娃',
      difficulty: 2,
      meter: '4/4',
      pickup: 0,
      notes: 28,
      lyrics: 28,
      digest: 'accd18a005dc225da618468a7c74112e154864025bdd5d05909ffdce7729b5df',
      url: 'https://jianpu.space/zh-tw/songList/80',
    },
    'little-mouse-on-the-lampstand-zh': {
      title: '小老鼠上燈台',
      difficulty: 3,
      meter: '2/4',
      pickup: 0,
      notes: 26,
      lyrics: 25,
      digest: 'e91a7a7b500e449371be8e5ee9ac2b7e6400b835ee2ac29453153e34e2f2ef80',
      url: 'https://img.qpx.com/uploads/allimg/160323/20545-1603231014491H.png',
    },
  };

  for (const [id, expected] of Object.entries(specs)) {
    const song = book.library.songs.find((candidate) => candidate.id === id);
    assert.ok(song, id);
    assert.equal(song.title, expected.title);
    assert.equal(song.difficulty, expected.difficulty);
    assert.equal(song.key, 'C major');
    assert.equal(song.meter, expected.meter);
    assert.equal(song.pickup_eighth_units, expected.pickup);
    assert.equal(song.source.url, expected.url);
    assert.ok(Object.values(song.verification).every((value) => value === true));

    const events = flattenEvents(song);
    assert.equal(events.filter((event) => event.kind === 'note').length, expected.notes);
    const track = song.lyric_tracks.find((candidate) => candidate.default);
    assert.equal(track.syllables.length, expected.lyrics);

    const compactMeasures = song.measures.map((measure) => measure.events.map(
      (event) => [event.pitch ?? null, event.duration],
    ));
    const digest = createHash('sha256').update(JSON.stringify(compactMeasures)).digest('hex');
    assert.equal(digest, expected.digest, id);
  }

  const farmer = book.library.songs.find((candidate) => candidate.id === 'the-farmer-in-the-dell');
  assert.deepEqual(farmer.ties, [{ id: 't01', from: 'n06', to: 'n07' }]);
  assert.deepEqual(farmer.lyric_tracks[0].continuations, [{ from: 'n06', through: 'n07' }]);

  const mouse = book.library.songs.find((candidate) => candidate.id === 'little-mouse-on-the-lampstand-zh');
  assert.deepEqual(mouse.lyric_tracks[0].continuations, [{ from: 'n17', through: 'n18' }]);
});
