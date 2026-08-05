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

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
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

  const layout = book?.layout;
  const page = layout?.page;
  const title = layout?.title;
  const system = layout?.notation_system;
  const illustration = layout?.illustration;

  if (layout?.profile !== 'a4_japanese_textbook') {
    fail('layout-profile', 'layout.profile 必須是 a4_japanese_textbook', 'layout.profile');
  }
  if (page?.size !== 'A4' || page?.orientation !== 'portrait' || page?.width_mm !== 210 || page?.height_mm !== 297) {
    fail('page-geometry', '頁面必須固定為 A4 直式 210 × 297mm', 'layout.page');
  }
  if (!isPositiveNumber(page?.margin_mm) || page.margin_mm * 2 >= page.width_mm || page?.fixed_aspect_ratio !== true) {
    fail('page-margin', 'A4 頁面需有合法邊界並固定長寬比', 'layout.page');
  }
  if (title?.style !== 'rounded_textbook_label' || title?.alignment !== 'left') {
    fail('title-layout', '標題需使用靠左的圓角教材標籤', 'layout.title');
  }
  if (!isPositiveNumber(title?.max_width_percent) || title.max_width_percent > 100) {
    fail('title-width', '標題寬度百分比必須介於 0 與 100', 'layout.title.max_width_percent');
  }
  if (system?.colored_note_boxes_primary !== true || system?.staff_secondary !== true) {
    fail('notation-priority', '彩色方框簡譜必須是主視覺，五線譜為輔助', 'layout.notation_system');
  }
  if (!Number.isInteger(system?.max_events_per_system) || system.max_events_per_system <= 0) {
    fail('system-event-count', '每個譜行的最大 event 數必須是正整數', 'layout.notation_system.max_events_per_system');
  }
  if (system?.horizontal_overflow !== 'forbidden' || system?.note_row_border !== 'none') {
    fail('system-overflow', '譜行不得橫向捲動，也不得使用原本的大外框', 'layout.notation_system');
  }
  if (!isPositiveNumber(system?.system_gap_px)) {
    fail('system-gap', '譜行間距必須是正數', 'layout.notation_system.system_gap_px');
  }
  if (
    illustration?.mode !== 'optional_later'
    || illustration?.carries_text !== false
    || illustration?.carries_notation !== false
    || illustration?.reserved_area !== 'none'
    || illustration?.piano_keyboard !== 'forbidden'
  ) {
    fail('illustration-rule', '插圖本次不預留，且不得承載文字、琴譜或鋼琴鍵盤', 'layout.illustration');
  }

  const noteBox = book?.notation?.note_box;
  const octaveDot = book?.notation?.octave_dot;
  const typography = book?.notation?.typography;
  const upper = book?.notation?.upper_dot;
  const lower = book?.notation?.lower_dot;

  for (const field of ['width_px', 'height_px', 'border_width_px', 'border_radius_px', 'vertical_padding_px']) {
    if (!isPositiveNumber(noteBox?.[field])) {
      fail('note-box-design', `notation.note_box.${field} 必須是正數`, `notation.note_box.${field}`);
    }
  }
  for (const field of ['note_number_px', 'lyric_px', 'extension_px']) {
    if (!isPositiveNumber(typography?.[field])) {
      fail('notation-typography', `notation.typography.${field} 必須是正數`, `notation.typography.${field}`);
    }
  }
  if (octaveDot?.shape !== 'circle') {
    fail('octave-dot-shape', '上下點必須使用圓形', 'notation.octave_dot.shape');
  }
  for (const field of ['diameter_px', 'min_border_clearance_px', 'min_number_clearance_px']) {
    if (!isPositiveNumber(octaveDot?.[field])) {
      fail('octave-dot-design', `notation.octave_dot.${field} 必須是正數`, `notation.octave_dot.${field}`);
    }
  }

  if (upper?.location !== 'inside_box' || upper?.alignment !== 'centered_above_number' || upper?.color !== 'inherit') {
    fail('upper-dot-rule', '上點必須在框內、數字正上方、繼承數字顏色', 'notation.upper_dot');
  }
  if (lower?.location !== 'inside_box' || lower?.alignment !== 'centered_below_number' || lower?.color !== 'inherit') {
    fail('lower-dot-rule', '下點必須在框內、數字正下方、繼承數字顏色', 'notation.lower_dot');
  }

  const layoutValues = [
    noteBox?.height_px,
    noteBox?.border_width_px,
    noteBox?.vertical_padding_px,
    octaveDot?.diameter_px,
    octaveDot?.min_border_clearance_px,
    octaveDot?.min_number_clearance_px,
  ];
  if (layoutValues.every(isPositiveNumber)) {
    const actualBorderClearance = noteBox.border_width_px + noteBox.vertical_padding_px;
    if (actualBorderClearance < octaveDot.min_border_clearance_px) {
      fail(
        'octave-dot-border-clearance',
        `上下點距框外緣僅 ${actualBorderClearance}px，小於規格 ${octaveDot.min_border_clearance_px}px`,
        'notation',
      );
    }

    const innerHeight = noteBox.height_px
      - noteBox.border_width_px * 2
      - noteBox.vertical_padding_px * 2;
    const reservedHeight = octaveDot.diameter_px * 2
      + octaveDot.min_number_clearance_px * 2;
    if (innerHeight <= reservedHeight) {
      fail(
        'octave-dot-number-space',
        '音符框扣除上下點與安全距離後，沒有保留數字顯示空間',
        'notation',
      );
    }
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
  const requiredGates = ['content', 'html', 'visual', 'print', 'release'];
  if (requiredGates.some((gate) => !book?.gates?.[gate]?.required)) {
    fail('required-gates', 'content、html、visual、print、release Gate 都必須啟用', 'gates');
  }

  return { pass: errors.length === 0, errors, warnings };
}
