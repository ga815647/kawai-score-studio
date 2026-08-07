import { readFile } from 'node:fs/promises';
import YAML from 'yaml';

export async function loadYaml(path) {
  const source = await readFile(path, 'utf8');
  return { source, data: YAML.parse(source) };
}

export async function loadScorebook(path = 'scorebook.yaml') {
  return loadYaml(path);
}

export async function loadFixtures(path = 'fixtures/engine-fixtures.yaml') {
  return loadYaml(path);
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

export function parseMeter(value) {
  const match = /^(\d+)\/(2|4|8|16)$/.exec(String(value));
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  const capacityEighthUnits = numerator * (8 / denominator);
  if (!Number.isInteger(capacityEighthUnits) || capacityEighthUnits <= 0) return null;
  return { numerator, denominator, capacityEighthUnits };
}

export function flattenEvents(score) {
  return (score.measures ?? []).flatMap((measure) => measure.events ?? []);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isSupportedDuration(value) {
  return Number.isFinite(value) && value > 0 && Number.isInteger(value * 2);
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateScoreData(score, options) {
  const { path, playable, requireVerifiedSource, requireSynthetic } = options;
  const errors = [];
  const warnings = [];
  const fail = (code, message, subpath = '') => errors.push({
    code,
    message,
    path: subpath ? `${path}.${subpath}` : path,
  });

  if (!score?.id || typeof score.id !== 'string') fail('score-id', '曲譜需要字串 id', 'id');
  if (!score?.title || typeof score.title !== 'string') fail('score-title', '曲譜需要 title', 'title');
  if (!parseMeter(score?.meter)) fail('score-meter', '曲譜需要可轉換成八分音符單位的拍號', 'meter');
  if (typeof score?.key !== 'string' || !/^[A-G](?:#|b)? major$/.test(score.key)) {
    fail('score-key', '曲譜目前只接受 major 調性', 'key');
  }

  if (requireSynthetic && score?.synthetic !== true) {
    fail('fixture-synthetic', '引擎 fixture 必須明確標示 synthetic: true', 'synthetic');
  }
  if (requireSynthetic && score?.status !== 'fixture') {
    fail('fixture-status', '引擎 fixture 的 status 必須是 fixture', 'status');
  }

  if (requireVerifiedSource) {
    if (score?.status !== 'verified') fail('public-status', '公開曲目 status 必須是 verified', 'status');
    const source = score?.source;
    const requiredSourceFields = [
      'title',
      'url',
      'publisher',
      'accessed_at',
      'selected_variant',
      'original_key',
      'original_meter',
      'pickup',
      'rights_status',
    ];
    for (const field of requiredSourceFields) {
      if (source?.[field] === undefined || source?.[field] === '') {
        fail('source-field', `公開曲目缺少來源欄位 ${field}`, `source.${field}`);
      }
    }
    if (source?.url && !/^https:\/\//.test(source.url)) fail('source-url', '來源 URL 必須使用 https', 'source.url');
    if (source?.accessed_at && !isIsoDate(source.accessed_at)) fail('source-date', 'accessed_at 必須是 YYYY-MM-DD', 'source.accessed_at');
    if (source?.original_meter && !parseMeter(source.original_meter)) fail('source-meter', '來源拍號不合法', 'source.original_meter');

    const verification = score?.verification;
    for (const field of [
      'melody_checked',
      'rhythm_checked',
      'rests_checked',
      'pickup_checked',
      'measures_checked',
      'ties_checked',
      'lyrics_checked',
      'user_approved',
    ]) {
      if (verification?.[field] !== true) {
        fail('verification-field', `公開曲目 verification.${field} 必須是 true`, `verification.${field}`);
      }
    }
  }

  const meter = parseMeter(score?.meter);
  if (!Array.isArray(score?.measures) || score.measures.length === 0) {
    fail('measures', '曲譜必須有明確 measures', 'measures');
    return { errors, warnings };
  }

  const eventById = new Map();
  const eventOrder = new Map();
  let order = 0;
  let pickupCapacity = 0;
  const measureNumbers = new Set();

  score.measures.forEach((measure, measureIndex) => {
    const measurePath = `measures[${measureIndex}]`;
    if (!Number.isInteger(measure?.number) || measureNumbers.has(measure.number)) {
      fail('measure-number', '小節 number 必須是唯一整數', `${measurePath}.number`);
    }
    measureNumbers.add(measure?.number);

    if (!isPositiveInteger(measure?.capacity_eighth_units)) {
      fail('measure-capacity', '小節需要正整數 capacity_eighth_units', `${measurePath}.capacity_eighth_units`);
    }
    if (!Array.isArray(measure?.events) || measure.events.length === 0) {
      fail('measure-events', '小節至少需要一個 note 或 rest event', `${measurePath}.events`);
      return;
    }

    const isPickup = measure.pickup === true;
    if (isPickup) {
      if (measure.number !== 0 || measureIndex !== 0) fail('pickup-position', '弱起小節必須是第一個且 number 為 0', measurePath);
      pickupCapacity = measure.capacity_eighth_units;
    } else if (meter && measure.capacity_eighth_units !== meter.capacityEighthUnits) {
      fail(
        'measure-meter-capacity',
        `完整小節容量必須是 ${meter.capacityEighthUnits} 個八分音符單位`,
        `${measurePath}.capacity_eighth_units`,
      );
    }

    let durationSum = 0;
    measure.events.forEach((event, eventIndex) => {
      const eventPath = `${measurePath}.events[${eventIndex}]`;
      if (!event?.id || typeof event.id !== 'string' || eventById.has(event.id)) {
        fail('event-id', 'event id 必須是唯一非空字串', `${eventPath}.id`);
      }
      if (!['note', 'rest'].includes(event?.kind)) {
        fail('event-kind', 'event kind 只能是 note 或 rest', `${eventPath}.kind`);
      }
      if (!isSupportedDuration(event?.duration)) {
        fail('event-duration', 'event duration 必須是 0.5 個八分音符單位的正倍數', `${eventPath}.duration`);
      } else {
        durationSum += event.duration;
      }
      if ('lyric' in (event ?? {}) || 'text' in (event ?? {})) {
        fail('event-embedded-lyric', 'melody event 不得內嵌歌詞', eventPath);
      }
      if (event?.kind === 'note') {
        const parsed = parsePitch(event.pitch);
        if (!parsed) fail('event-pitch', 'note event 需要合法 pitch', `${eventPath}.pitch`);
        else if (!playable.has(parsed.token)) fail('instrument-range', `${parsed.token} 不在 KAWAI 16 音範圍`, `${eventPath}.pitch`);
      }
      if (event?.kind === 'rest' && 'pitch' in event) {
        fail('rest-pitch', 'rest event 不得有 pitch', `${eventPath}.pitch`);
      }
      if (event?.id) {
        eventById.set(event.id, event);
        eventOrder.set(event.id, order);
      }
      order += 1;
    });

    if (isPositiveInteger(measure?.capacity_eighth_units) && durationSum !== measure.capacity_eighth_units) {
      fail(
        'measure-duration-sum',
        `小節 event 時值總和 ${durationSum} 不等於容量 ${measure.capacity_eighth_units}`,
        measurePath,
      );
    }
  });

  const declaredPickup = score?.pickup_eighth_units ?? 0;
  if (!Number.isInteger(declaredPickup) || declaredPickup < 0) {
    fail('pickup-value', 'pickup_eighth_units 必須是非負整數', 'pickup_eighth_units');
  } else if (declaredPickup !== pickupCapacity) {
    fail('pickup-capacity', 'pickup_eighth_units 必須等於弱起小節容量', 'pickup_eighth_units');
  }

  const tieIds = new Set();
  for (const [tieIndex, tie] of (score.ties ?? []).entries()) {
    const tiePath = `ties[${tieIndex}]`;
    if (!tie?.id || tieIds.has(tie.id)) fail('tie-id', 'tie id 必須唯一', `${tiePath}.id`);
    tieIds.add(tie?.id);
    const from = eventById.get(tie?.from);
    const to = eventById.get(tie?.to);
    if (!from || from.kind !== 'note') fail('tie-from', 'tie.from 必須指向 note event', `${tiePath}.from`);
    if (!to || to.kind !== 'note') fail('tie-to', 'tie.to 必須指向 note event', `${tiePath}.to`);
    if (from && to && from.pitch !== to.pitch) fail('tie-pitch', '連結線兩端音高必須相同', tiePath);
    if (from && to && eventOrder.get(tie.from) >= eventOrder.get(tie.to)) {
      fail('tie-order', 'tie.from 必須早於 tie.to', tiePath);
    }
  }

  const tracks = score?.lyric_tracks;
  if (!Array.isArray(tracks) || tracks.length === 0) {
    fail('lyric-tracks', '曲譜需要獨立 lyric_tracks', 'lyric_tracks');
    return { errors, warnings };
  }
  const trackIds = new Set();
  const defaults = tracks.filter((track) => track.default === true);
  if (defaults.length !== 1) fail('lyric-default', '必須恰好有一個 default lyric track', 'lyric_tracks');
  if (defaults[0]?.role !== 'original') fail('lyric-original-default', '預設 lyric track 必須是 original language', 'lyric_tracks');

  tracks.forEach((track, trackIndex) => {
    const trackPath = `lyric_tracks[${trackIndex}]`;
    if (!track?.id || trackIds.has(track.id)) fail('lyric-track-id', 'lyric track id 必須唯一', `${trackPath}.id`);
    trackIds.add(track?.id);
    if (!track?.locale || typeof track.locale !== 'string') fail('lyric-locale', 'lyric track 需要 locale', `${trackPath}.locale`);
    if (!['original', 'translation'].includes(track?.role)) fail('lyric-role', 'lyric role 只能是 original 或 translation', `${trackPath}.role`);
    if (!Array.isArray(track?.syllables)) fail('lyric-syllables', 'lyric track 需要 syllables 陣列', `${trackPath}.syllables`);
    const usedEvents = new Set();
    for (const [syllableIndex, syllable] of (track.syllables ?? []).entries()) {
      const syllablePath = `${trackPath}.syllables[${syllableIndex}]`;
      const event = eventById.get(syllable?.event);
      if (!event || event.kind !== 'note') fail('lyric-event', '歌詞只能指向存在的 note event', `${syllablePath}.event`);
      if (usedEvents.has(syllable?.event)) fail('lyric-event-duplicate', '同一 track 的 event 不可重複歌詞', `${syllablePath}.event`);
      usedEvents.add(syllable?.event);
      if (typeof syllable?.text !== 'string' || syllable.text.length === 0) {
        fail('lyric-text', 'syllable text 必須是非空字串', `${syllablePath}.text`);
      }
    }
  });

  return { errors, warnings };
}

export function validateProject(book, fixtureBook) {
  const errors = [];
  const warnings = [];
  const fail = (code, message, path = '') => errors.push({ code, message, path });

  if (!isObject(book)) return { pass: false, errors: [{ code: 'invalid-root', message: 'scorebook 必須是物件', path: '' }], warnings };
  if (book?.project?.canonical_file !== 'scorebook.yaml') fail('canonical-file', 'canonical_file 必須是 scorebook.yaml', 'project.canonical_file');
  if (book?.schema?.version !== 2) fail('schema-version', 'schema.version 必須是 2', 'schema.version');
  if (book?.schema?.duration_unit !== 'eighth_note' || book?.schema?.duration_quantum_eighth_units !== 0.5 || book?.schema?.smallest_supported_duration !== 'sixteenth_note') {
    fail('schema-duration', '時值規格必須以八分音符為單位並支援 0.5 單位的十六分音符', 'schema');
  }
  if (book?.schema?.melody_and_lyrics_are_separate !== true) fail('schema-lyrics', '旋律與歌詞必須分離', 'schema');
  if (book?.schema?.measures_are_explicit !== true || book?.schema?.pickup_is_explicit !== true || book?.schema?.ties_are_explicit !== true) {
    fail('schema-music-structure', '小節、弱起與連結線必須明確建模', 'schema');
  }

  const keys = book?.instrument?.keys;
  if (!Array.isArray(keys) || keys.length !== 16 || new Set(keys.map(String)).size !== 16) {
    fail('instrument-keys', 'instrument.keys 必須是 16 個不重複音', 'instrument.keys');
  }
  const playable = new Set((keys ?? []).map(String));
  for (const [index, token] of (keys ?? []).entries()) {
    if (!parsePitch(token)) fail('instrument-token', `非法琴鍵 ${token}`, `instrument.keys[${index}]`);
  }
  for (let degree = 1; degree <= 7; degree += 1) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(book?.palette?.[String(degree)]?.hex ?? '')) {
      fail('palette', `數字 ${degree} 缺少合法顏色`, `palette.${degree}`);
    }
  }

  if (book?.rendering?.staff?.engine !== 'vexflow' || book?.rendering?.staff?.version !== '5.0.0') {
    fail('staff-engine', '五線譜必須固定使用 VexFlow 5.0.0', 'rendering.staff');
  }
  if (book?.rendering?.playback?.engine !== 'web_audio' || book?.rendering?.playback?.github_actions_required !== false) {
    fail('playback-mode', '播放必須在瀏覽器本機完成且不依賴 Actions', 'rendering.playback');
  }
  if (book?.modes?.studio?.github_required !== false || book?.modes?.studio?.github_actions_required !== false) {
    fail('studio-mode', 'Studio 不得依賴 GitHub 或 Actions', 'modes.studio');
  }
  if (JSON.stringify(book?.layout?.vertical_order) !== JSON.stringify(['numbered_notation', 'staff', 'lyrics'])) {
    fail('vertical-order', '版面順序必須是簡譜、五線譜、歌詞', 'layout.vertical_order');
  }
  if (
    book?.notation?.lyrics?.renderer !== 'html_overlay'
    || book?.notation?.lyrics?.vertical_alignment !== 'shared_baseline'
  ) {
    fail('lyric-rendering', '歌詞必須使用獨立 HTML 列並共用 baseline', 'notation.lyrics');
  }

  const geometry = book?.layout?.system_geometry;
  for (const field of [
    'staff_width_px',
    'staff_canvas_height_px',
    'stave_top_line_y_px',
    'numbered_row_height_px',
    'numbered_to_staff_top_line_gap_px',
  ]) {
    if (!isPositiveNumber(geometry?.[field])) {
      fail('system-geometry', `layout.system_geometry.${field} 必須是正數`, `layout.system_geometry.${field}`);
    }
  }
  const lyricRow = geometry?.lyric_row;
  if (
    !isPositiveNumber(lyricRow?.staff_bottom_line_to_top_px)
    || !isPositiveNumber(lyricRow?.line_height_px)
    || !isNonNegativeNumber(lyricRow?.max_vertical_alignment_delta_px)
  ) {
    fail('lyric-row-geometry', '歌詞列距離、行高與對齊容許值必須合法', 'layout.system_geometry.lyric_row');
  }

  const visualMeasurements = book?.gates?.visual?.measurements;
  for (const field of ['numbered_to_staff_top_line_gap_px', 'staff_bottom_line_to_lyric_top_px']) {
    const range = visualMeasurements?.[field];
    if (!isNonNegativeNumber(range?.min) || !isPositiveNumber(range?.max) || range.min > range.max) {
      fail('visual-gap-range', `${field} 必須有合法 min/max`, `gates.visual.measurements.${field}`);
    }
  }
  if (!isNonNegativeNumber(visualMeasurements?.lyric_vertical_alignment_delta_px?.max)) {
    fail(
      'lyric-alignment-range',
      '歌詞垂直對齊容許值必須是非負數',
      'gates.visual.measurements.lyric_vertical_alignment_delta_px.max',
    );
  }
  if (
    lyricRow
    && visualMeasurements?.lyric_vertical_alignment_delta_px?.max !== lyricRow.max_vertical_alignment_delta_px
  ) {
    fail('lyric-alignment-contract', '版型與 Visual Gate 的歌詞對齊容許值必須一致', 'gates.visual.measurements');
  }

  if (book?.layout?.system_breaking?.strategy !== 'measure_and_required_width' || book?.layout?.system_breaking?.fixed_event_count_breaks !== 'forbidden') {
    fail('system-breaking', '換行必須依小節與實際寬度，不可固定 event 數', 'layout.system_breaking');
  }

  const songs = book?.library?.songs;
  if (!Array.isArray(songs)) fail('library-songs', 'library.songs 必須是陣列', 'library.songs');
  for (const [songIndex, song] of (songs ?? []).entries()) {
    const result = validateScoreData(song, {
      path: `library.songs[${songIndex}]`,
      playable,
      requireVerifiedSource: true,
      requireSynthetic: false,
    });
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  const quarantine = book?.library?.quarantine;
  if (!Array.isArray(quarantine)) fail('quarantine', 'library.quarantine 必須是陣列', 'library.quarantine');
  for (const [index, item] of (quarantine ?? []).entries()) {
    if (!item?.id || !item?.title || !item?.reason) fail('quarantine-entry', '隔離項目需要 id、title、reason', `library.quarantine[${index}]`);
    for (const forbidden of ['measures', 'events', 'phrases', 'lyric_tracks']) {
      if (forbidden in (item ?? {})) fail('quarantine-content', `隔離項目不得含 ${forbidden}`, `library.quarantine[${index}].${forbidden}`);
    }
  }

  if (book?.fixtures?.synthetic_only !== true || book?.fixtures?.may_be_published_as_songs !== false) {
    fail('fixture-policy', 'fixture 必須只用合成資料且不可當正式歌曲發佈', 'fixtures');
  }
  if (!isObject(fixtureBook) || !Array.isArray(fixtureBook.fixtures) || fixtureBook.fixtures.length === 0) {
    fail('fixtures-empty', 'fixture 檔至少需要一個合成 fixture', 'fixtures');
  }
  for (const [fixtureIndex, fixture] of (fixtureBook?.fixtures ?? []).entries()) {
    const result = validateScoreData(fixture, {
      path: `fixtures[${fixtureIndex}]`,
      playable,
      requireVerifiedSource: false,
      requireSynthetic: true,
    });
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  for (const gate of ['content', 'fixture', 'html', 'visual', 'print', 'release']) {
    if (book?.gates?.[gate]?.required !== true) fail('required-gate', `${gate} Gate 必須啟用`, `gates.${gate}.required`);
  }

  return {
    pass: errors.length === 0,
    errors,
    warnings,
    counts: {
      verifiedSongs: songs?.length ?? 0,
      quarantinedEntries: quarantine?.length ?? 0,
      fixtures: fixtureBook?.fixtures?.length ?? 0,
    },
  };
}
