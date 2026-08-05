import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScorebook, parsePitch, validateScorebook } from '../scripts/lib.mjs';

test('scorebook passes content gate', async () => {
  const { data } = await loadScorebook();
  const result = validateScorebook(data);
  assert.equal(result.pass, true, JSON.stringify(result.errors, null, 2));
});

test('instrument has the expected 16-note range', async () => {
  const { data } = await loadScorebook();
  assert.deepEqual(data.instrument.keys, [
    '4_', '5_', '6_', '7_', '1', '2', '3', '4',
    '5', '6', '7', '1^', '2^', '3^', '4^', '5^',
  ]);
});

test('octave dots use the approved visual rule', async () => {
  const { data } = await loadScorebook();
  assert.deepEqual(data.notation.upper_dot, {
    location: 'inside_box',
    alignment: 'centered_above_number',
    color: 'inherit',
  });
  assert.deepEqual(data.notation.lower_dot, {
    location: 'inside_box',
    alignment: 'centered_below_number',
    color: 'inherit',
  });
});

test('every rendered event pitch is parseable and playable', async () => {
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
