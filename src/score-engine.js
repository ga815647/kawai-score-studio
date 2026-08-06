const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const LETTER_INDEX = new Map(LETTERS.map((letter, index) => [letter, index]));
const DURATION_PARTS = [
  { units: 6, duration: 'hd', dots: 1 },
  { units: 4, duration: 'h', dots: 0 },
  { units: 3, duration: 'qd', dots: 1 },
  { units: 2, duration: 'q', dots: 0 },
  { units: 1, duration: '8', dots: 0 },
];

export function parsePitch(token) {
  const match = /^([1-7])(\^|_)?$/.exec(String(token));
  if (!match) throw new Error(`非法音符：${token}`);
  return {
    token: String(token),
    degree: Number(match[1]),
    octave: match[2] === '^' ? 1 : match[2] === '_' ? -1 : 0,
  };
}

export function parseMajorKey(value) {
  const match = /^([A-G])([#b]?) major$/.exec(String(value));
  if (!match) throw new Error(`目前不支援調性：${value}`);
  return {
    tonicLetter: match[1].toLowerCase(),
    signature: `${match[1]}${match[2]}`,
  };
}

export function pitchToVexKey(token, keyName, tonicOctave = 4) {
  const pitch = parsePitch(token);
  const key = parseMajorKey(keyName);
  const tonicIndex = LETTER_INDEX.get(key.tonicLetter);
  const absoluteIndex = tonicIndex + pitch.degree - 1 + pitch.octave * 7;
  const letter = LETTERS[((absoluteIndex % 7) + 7) % 7];
  const octave = tonicOctave + Math.floor(absoluteIndex / 7);
  return `${letter}/${octave}`;
}

export function decomposeDuration(units) {
  if (!Number.isInteger(units) || units <= 0) throw new Error(`非法時值：${units}`);
  const parts = [];
  let remaining = units;
  for (const part of DURATION_PARTS) {
    while (remaining >= part.units) {
      parts.push({ ...part });
      remaining -= part.units;
    }
  }
  if (remaining !== 0) throw new Error(`無法拆解時值：${units}`);
  return parts;
}

export function flattenMeasures(score) {
  return score.measures.flatMap((measure) => measure.events.map((event, eventIndex) => ({
    ...event,
    measureNumber: measure.number,
    measurePickup: measure.pickup === true,
    measureEnd: eventIndex === measure.events.length - 1,
  })));
}

export function selectLyricTrack(score, trackId) {
  const tracks = score.lyric_tracks ?? [];
  const track = trackId
    ? tracks.find((candidate) => candidate.id === trackId)
    : tracks.find((candidate) => candidate.default === true);
  if (!track) throw new Error('找不到歌詞 track');
  return track;
}

export function lyricMapForTrack(score, trackId) {
  const track = selectLyricTrack(score, trackId);
  return new Map(track.syllables.map((syllable) => [syllable.event, syllable.text]));
}

export function createRenderModel(score, trackId) {
  const lyricMap = lyricMapForTrack(score, trackId);
  const events = flattenMeasures(score);
  const segments = [];
  const eventRanges = new Map();
  const ties = [];
  let totalEighthUnits = 0;

  for (const event of events) {
    const parts = decomposeDuration(event.duration);
    const firstSegmentIndex = segments.length;
    parts.forEach((part, partIndex) => {
      const segmentIndex = segments.length;
      segments.push({
        eventId: event.id,
        eventKind: event.kind,
        pitch: event.pitch ?? null,
        vexKey: event.kind === 'note' ? pitchToVexKey(event.pitch, score.key) : 'b/4',
        vexDuration: `${part.duration}${event.kind === 'rest' ? 'r' : ''}`,
        dots: part.dots,
        durationUnits: part.units,
        eventAnchor: partIndex === 0,
        lyric: partIndex === 0 ? lyricMap.get(event.id) ?? '' : '',
        measureEnd: event.measureEnd && partIndex === parts.length - 1,
      });
      if (event.kind === 'note' && partIndex > 0) {
        ties.push({ fromSegmentIndex: segmentIndex - 1, toSegmentIndex: segmentIndex, internal: true });
      }
    });
    eventRanges.set(event.id, {
      event,
      firstSegmentIndex,
      lastSegmentIndex: segments.length - 1,
    });
    totalEighthUnits += event.duration;
  }

  for (const tie of score.ties ?? []) {
    const from = eventRanges.get(tie.from);
    const to = eventRanges.get(tie.to);
    if (!from || !to) throw new Error(`無效連結線：${tie.id}`);
    ties.push({
      id: tie.id,
      fromSegmentIndex: from.lastSegmentIndex,
      toSegmentIndex: to.firstSegmentIndex,
      internal: false,
    });
  }

  return {
    score,
    track: selectLyricTrack(score, trackId),
    events,
    segments,
    eventRanges,
    ties,
    totalEighthUnits,
  };
}

const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const TONIC_MIDI = new Map([
  ['C', 60], ['C#', 61], ['Db', 61], ['D', 62], ['D#', 63], ['Eb', 63],
  ['E', 64], ['F', 65], ['F#', 66], ['Gb', 66], ['G', 67], ['G#', 68],
  ['Ab', 68], ['A', 69], ['A#', 70], ['Bb', 70], ['B', 71],
]);

export function pitchToFrequency(token, keyName) {
  const pitch = parsePitch(token);
  const tonic = keyName.replace(/ major$/, '');
  const tonicMidi = TONIC_MIDI.get(tonic);
  if (tonicMidi === undefined) throw new Error(`無法播放調性：${keyName}`);
  const midi = tonicMidi + MAJOR_SCALE_SEMITONES[pitch.degree - 1] + pitch.octave * 12;
  return 440 * (2 ** ((midi - 69) / 12));
}
