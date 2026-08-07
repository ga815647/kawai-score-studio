import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { flattenEvents, loadScorebook } from '../scripts/lib.mjs';

const specs = {
  'humpty-dumpty': {
    title: 'Humpty Dumpty', meter: '6/8', pickup: 0, measures: 8,
    events: 36, notes: 36, rests: 0, lyrics: 36, locale: 'en',
    url: 'https://www.kidsplaymusic.com/humpty-dumpty-piano/',
    digest: 'f5bd41d7ab8e181f8e03f8e90c7e77d1efcaa8b69b0fadf7fd93888eba6c5c70',
  },
  'little-donkey-zh': {
    title: '小毛驢', meter: '2/4', pickup: 0, measures: 16,
    events: 55, notes: 55, rests: 0, lyrics: 55, locale: 'zh-TW',
    url: 'https://jianpu.space/zh-tw/songList/7',
    digest: 'cfd73735eab5ce5223841bcfd6a897d8ce57e52b031cdecc64bfe617e253287e',
  },
  'find-a-friend-zh': {
    title: '找朋友', meter: '2/4', pickup: 0, measures: 8,
    events: 28, notes: 28, rests: 0, lyrics: 28, locale: 'zh-TW',
    url: 'https://www.everyonepiano.cn/Music-472.html',
    digest: '36c62fdf5a7c3ddc7e1ad26422637ced9a645535e8bac79fb284d0ec042a2322',
  },
  'london-bridge-zh': {
    title: '倫敦鐵橋垮下來', meter: '4/4', pickup: 0, measures: 8,
    events: 25, notes: 25, rests: 0, lyrics: 25, locale: 'zh-TW',
    url: 'https://jianpu.space/zh-tw/songList/1',
    digest: '7e8c343d43e16687e1497d13257f51ca70328697186278c7a5074e2772ce1d55',
  },
  'if-you-are-happy-clap-zh': {
    title: '如果感到幸福你就拍拍手', meter: '4/4', pickup: 2, measures: 9,
    events: 52, notes: 46, rests: 6, lyrics: 46, locale: 'zh-TW',
    url: 'https://erge.qpx.com/jianpu/149040.html',
    digest: '45ce434abe0e7b8f1e203ac352546f2a2ccb2369d4c0974cfd09db1f23b73099',
  },
};

test('five-song children batch exactly matches the fixed static-source event contracts', async () => {
  const { data: book } = await loadScorebook();
  for (const [id, spec] of Object.entries(specs)) {
    const song = book.library.songs.find((candidate) => candidate.id === id);
    assert.ok(song, id);
    assert.equal(song.title, spec.title, id);
    assert.equal(song.key, 'C major', id);
    assert.equal(song.meter, spec.meter, id);
    assert.equal(song.pickup_eighth_units, spec.pickup, id);
    assert.equal(song.measures.length, spec.measures, id);

    const events = flattenEvents(song);
    assert.equal(events.length, spec.events, id);
    assert.equal(events.filter((event) => event.kind === 'note').length, spec.notes, id);
    assert.equal(events.filter((event) => event.kind === 'rest').length, spec.rests, id);

    const track = song.lyric_tracks.find((candidate) => candidate.default);
    assert.equal(track.locale, spec.locale, id);
    assert.equal(track.role, 'original', id);
    assert.equal(track.syllables.length, spec.lyrics, id);
    assert.equal(song.source.url, spec.url, id);

    const digest = createHash('sha256').update(JSON.stringify(
      events.map((event) => [event.kind, event.pitch ?? null, event.duration]),
    )).digest('hex');
    assert.equal(digest, spec.digest, id);
    assert.ok(Object.values(song.verification).every((value) => value === true), id);
  }
});

test('幸福拍手歌 preserves the action rests and source-key transposition record', async () => {
  const { data: book } = await loadScorebook();
  const song = book.library.songs.find((candidate) => candidate.id === 'if-you-are-happy-clap-zh');
  assert.ok(song);
  assert.equal(song.source.original_key, 'G major');
  assert.equal(song.source.transposition_semitones, -7);
  assert.equal(song.measures[0].pickup, true);
  assert.equal(song.measures[0].capacity_eighth_units, 2);
  assert.equal(flattenEvents(song).filter((event) => event.kind === 'rest').length, 6);
});
