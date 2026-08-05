import { readFile } from 'node:fs/promises';
import YAML from 'yaml';

export async function loadScorebook(path = 'scorebook.yaml') {
  const source = await readFile(path, 'utf8');
  return { source, data: YAML.parse(source) };
}

export function parsePitch(token) {
  const match = /^([1-7])(\^|_)?$/.exec(String(token));
  if (!match) return null;
  return {
    token: String(token),
    degree: Number(match[1]),
    octave: match[2] === '^' ? 1 : match[2] === '_' ? -1 : 0,
  };
}

export function validateScorebook(book) {
  const errors = [];
  const warnings = [];
  const fail = (code, message, path = '') => errors.push({ code, message, path });
  const warn = (code, message, path = '') => warnings.push({ code, message, path });

  if (!book || typeof book !== 'object') {
    return { pass: false, errors: [{ code: 'invalid-root', message: 'scorebook 必須是物件', path: '' }], warnings };
  }

  if (book?.project?.canonical_file !== 'scorebook.yaml') {
    fail('canonical-file', 'project.canonical_file 必須是 scorebook.yaml', 'project.canonical_file');
  }

  const keys = book?.instrument?.keys;
  if (!Array.isArray(keys) || keys.length !== 16) {
    fail('instrument-key-count', 'instrument.keys 必須恰好有 16 個琴鍵', 'instrument.keys');
  }
  const keySet = new Set((keys ?? []).map(String));
  if (keySet.size !== (keys ?? []).length) {
    fail('instrument-key-duplicate', 'instrument.keys 不可重複', 'instrument.keys');
  }
  for (const [index, token] of (keys ?? []).entries()) {
    if (!parsePitch(token)) fail('instrument-key-token', `非法琴鍵：${token}`, `instrument.keys[${index}]`);
  }

  for (let degree = 1; degree <= 7; degree += 1) {
    const color = book?.palette?.[String(degree)];
    if (!color?.hex || !/^#[0-9A-Fa-f]{6}$/.test(color.hex)) {
      fail('palette-color', `數字 ${degree} 缺少合法 hex 色碼`, `palette.${degree}`);
    }
  }

  const upper = book?.notation?.upper_dot;
  const lower = book?.notation?.lower_dot;
  if (upper?.location !== 'inside_box' || upper?.alignment !== 'centered_above_number' || upper?.color !== 'inherit') {
    fail('upper-dot-rule', '上點必須在框內、數字正上方、繼承數字顏色', 'notation.upper_dot');
  }
  if (lower?.location !== 'inside_box' || lower?.alignment !== 'centered_below_number' || lower?.color !== 'inherit') {
    fail('lower-dot-rule', '下點必須在框內、數字正下方、繼承數字顏色', 'notation.lower_dot');
  }

  const songIds = new Set();
  for (const [songIndex, song] of (book.songs ?? []).entries()) {
    const songPath = `songs[${songIndex}]`;
    if (!song.id || songIds.has(song.id)) fail('song-id', `曲目 id 缺少或重複：${song.id ?? ''}`, `${songPath}.id`);
    songIds.add(song.id);
    if (!song.title) fail('song-title', '曲目缺少 title', `${songPath}.title`);
    if (song.status !== 'ready') warn('song-not-ready', `${song.title} 尚未標記 ready`, `${songPath}.status`);
    if (!song.source?.type || !song.source?.note) fail('song-source', `${song.title} 缺少來源說明`, `${songPath}.source`);
    if (!Array.isArray(song.phrases) || song.phrases.length === 0) fail('song-phrases', `${song.title} 缺少 phrases`, `${songPath}.phrases`);

    for (const [phraseIndex, phrase] of (song.phrases ?? []).entries()) {
      const phrasePath = `${songPath}.phrases[${phraseIndex}]`;
      if (!Array.isArray(phrase.events) || phrase.events.length === 0) {
        fail('phrase-events', `${song.title} 第 ${phraseIndex + 1} 句沒有 events`, `${phrasePath}.events`);
        continue;
      }
      for (const [eventIndex, event] of phrase.events.entries()) {
        const eventPath = `${phrasePath}.events[${eventIndex}]`;
        const parsed = parsePitch(event.pitch);
        if (!parsed) fail('pitch-token', `${song.title} 有非法音符 ${event.pitch}`, `${eventPath}.pitch`);
        else if (!keySet.has(parsed.token)) fail('instrument-range', `${song.title} 的 ${parsed.token} 不在這台琴上`, `${eventPath}.pitch`);
        if (!Number.isInteger(event.duration) || event.duration <= 0) {
          fail('duration', `${song.title} 的 duration 必須是正整數`, `${eventPath}.duration`);
        }
        if (typeof event.lyric !== 'string' || event.lyric.length === 0) {
          fail('lyric', `${song.title} 每個起音都必須有歌詞`, `${eventPath}.lyric`);
        }
      }
    }
  }

  if ((book.songs ?? []).length === 0) fail('songs-empty', '至少需要一首曲目', 'songs');
  if (!book?.gates?.content?.required || !book?.gates?.html?.required || !book?.gates?.print?.required) {
    fail('required-gates', 'content、html、print Gate 都必須啟用', 'gates');
  }

  return { pass: errors.length === 0, errors, warnings };
}
