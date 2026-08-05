const DIATONIC_LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const LETTER_INDEX = new Map(DIATONIC_LETTERS.map((letter, index) => [letter, index]));

const DURATION_PARTS = [
  { eighthUnits: 6, vexDuration: 'hd', dots: 1 },
  { eighthUnits: 4, vexDuration: 'h', dots: 0 },
  { eighthUnits: 3, vexDuration: 'qd', dots: 1 },
  { eighthUnits: 2, vexDuration: 'q', dots: 0 },
  { eighthUnits: 1, vexDuration: '8', dots: 0 },
];

export function parseNumberedPitch(token) {
  const match = /^([1-7])(\^|_)?$/.exec(String(token));
  if (!match) throw new Error(`非法音符：${token}`);
  return {
    degree: Number(match[1]),
    octave: match[2] === '^' ? 1 : match[2] === '_' ? -1 : 0,
  };
}

export function parseMajorKey(keyName) {
  const match = /^([A-G])([#b]?) major$/.exec(String(keyName));
  if (!match) throw new Error(`不支援的調性：${keyName}`);
  return {
    tonicLetter: match[1].toLowerCase(),
    keySignature: `${match[1]}${match[2]}`,
  };
}

export function parseMeter(meter) {
  const match = /^(\d+)\/(2|4|8|16)$/.exec(String(meter));
  if (!match || Number(match[1]) <= 0) throw new Error(`不支援的拍號：${meter}`);
  return {
    numerator: Number(match[1]),
    denominator: Number(match[2]),
  };
}

export function pitchToVexKey(token, keyName, tonicOctave = 4) {
  const { degree, octave } = parseNumberedPitch(token);
  const { tonicLetter } = parseMajorKey(keyName);
  const tonicIndex = LETTER_INDEX.get(tonicLetter);
  if (tonicIndex === undefined) throw new Error(`無法定位主音：${keyName}`);

  const absoluteDiatonicIndex = tonicIndex + (degree - 1) + octave * 7;
  const letterIndex = ((absoluteDiatonicIndex % 7) + 7) % 7;
  const staffOctave = tonicOctave + Math.floor(absoluteDiatonicIndex / 7);
  return `${DIATONIC_LETTERS[letterIndex]}/${staffOctave}`;
}

export function decomposeDuration(eighthUnits) {
  if (!Number.isInteger(eighthUnits) || eighthUnits <= 0) {
    throw new Error(`時值必須是正整數：${eighthUnits}`);
  }

  let remaining = eighthUnits;
  const parts = [];
  for (const part of DURATION_PARTS) {
    while (remaining >= part.eighthUnits) {
      parts.push({ ...part });
      remaining -= part.eighthUnits;
    }
  }
  if (remaining !== 0) throw new Error(`無法拆解時值：${eighthUnits}`);
  return parts;
}

export function createStaffModel(events, song) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('五線譜系統至少需要一個 event');
  }
  const { keySignature } = parseMajorKey(song.key);
  parseMeter(song.meter);

  const segments = [];
  const ties = [];
  const anchorSegmentIndexes = [];
  let totalEighthUnits = 0;

  events.forEach((event, eventIndex) => {
    const key = pitchToVexKey(event.pitch, song.key);
    const parts = decomposeDuration(event.duration);
    const firstSegmentIndex = segments.length;
    anchorSegmentIndexes.push(firstSegmentIndex);

    parts.forEach((part, partIndex) => {
      const segmentIndex = segments.length;
      segments.push({
        ...part,
        key,
        eventIndex,
        isEventAnchor: partIndex === 0,
        barAfter: Boolean(event.bar_after && partIndex === parts.length - 1),
      });
      if (partIndex > 0) {
        ties.push({
          fromSegmentIndex: segmentIndex - 1,
          toSegmentIndex: segmentIndex,
          eventIndex,
        });
      }
    });
    totalEighthUnits += event.duration;
  });

  return {
    keySignature,
    meter: song.meter,
    segments,
    ties,
    anchorSegmentIndexes,
    totalEighthUnits,
  };
}
