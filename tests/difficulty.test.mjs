import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import YAML from 'yaml';

const book = YAML.parse(await readFile('scorebook.yaml', 'utf8'));
const app = await readFile('src/app.js', 'utf8');

const songById = (id) => book.library.songs.find((song) => song.id === id);

test('all verified songs have an integer difficulty from 1 to 5', () => {
  assert.equal(book.schema.song_difficulty.field, 'difficulty');
  assert.equal(book.schema.song_difficulty.scale_min, 1);
  assert.equal(book.schema.song_difficulty.scale_max, 5);
  assert.equal(book.schema.song_difficulty.display, 'five_star_rating');
  assert.equal(book.schema.song_difficulty.sort_order, 'ascending_then_title');
  assert.equal(book.modes.library.song_directory.sort_order, 'difficulty_ascending_then_title');
  assert.equal(book.layout.navigation.song_directory.sort_order, 'difficulty_ascending_then_title');

  // Includes the verified 0.6.28 four-song static-source batch.
  assert.equal(book.library.songs.length, 45);
  for (const song of book.library.songs) {
    assert.equal(song.status, 'verified');
    assert.equal(Number.isInteger(song.difficulty), true, `${song.id}: difficulty must be an integer`);
    assert.ok(song.difficulty >= 1 && song.difficulty <= 5, `${song.id}: difficulty out of range`);
  }
});

test('difficulty calibration keeps clear easy and hard anchors', () => {
  assert.equal(songById('twinkle-twinkle-little-star-zh').difficulty, 1);
  assert.equal(songById('mary-had-a-little-lamb-zh').difficulty, 1);
  assert.equal(songById('canon-in-d').difficulty, 5);
});

test('library renderer exposes five-star difficulty and sorts easy to hard', () => {
  assert.match(app, /function difficultyStars\(score\)/);
  assert.match(app, /'★'\.repeat\(difficulty\)/);
  assert.match(app, /'☆'\.repeat\(5 - difficulty\)/);
  assert.match(app, /left\.difficulty - right\.difficulty/);
  assert.match(app, /const sortedSongs = \[\.\.\.book\.library\.songs\]\.sort\(compareSongDifficulty\);/);
  assert.match(app, /link\.textContent = `\$\{scoreLabel\(song\)\} · \$\{difficultyStars\(song\)\}`;/);
  assert.match(app, /meta\.textContent = `難度 \$\{difficultyStars\(song\)\}/);
});
