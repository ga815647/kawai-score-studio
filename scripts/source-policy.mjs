function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

function hasAll(values, required) {
  return Array.isArray(values) && required.every((item) => values.includes(item));
}

export function adaptBookForLegacyValidation(book) {
  const adapted = structuredClone(book);
  for (const song of adapted?.library?.songs ?? []) {
    const source = song?.source;
    if (!isObject(source)) continue;
    if (!isPresent(source.publisher) && isPresent(source.publisher_or_origin)) {
      source.publisher = source.publisher_or_origin;
    }
    if (!isPresent(source.url) && isPresent(source.file_reference)) {
      const identity = source.content_sha256 || song.id || 'private-source';
      source.url = `https://source-record.invalid/${encodeURIComponent(String(identity))}`;
    }
  }
  return adapted;
}

export function validateSourcePolicy(book) {
  const errors = [];
  const warnings = [];
  const fail = (code, message, path = '') => errors.push({ code, message, path });

  const entry = book?.interaction_entry;
  if (entry?.project_mode !== 'single_chat_project') {
    fail('project-entry-mode', 'Project 必須使用單一 ChatGPT 入口', 'interaction_entry.project_mode');
  }
  if (entry?.project_name !== 'Kawai Score Studio') {
    fail('project-entry-name', '單一入口名稱必須是 Kawai Score Studio', 'interaction_entry.project_name');
  }
  if (entry?.user_selects_work_type !== false || entry?.assistant_classifies_request !== true) {
    fail('project-entry-routing', '使用者不需選模式，工作類型由助理判斷', 'interaction_entry');
  }
  if (!hasAll(entry?.handles, ['score_content', 'generator_development'])) {
    fail('project-entry-scope', '單一入口必須同時處理琴譜內容與產生器開發', 'interaction_entry.handles');
  }
  if (!hasAll(entry?.website_modes_remain_internal, ['library', 'studio'])) {
    fail('website-mode-boundary', '正式曲庫與 Studio 只能是網站內部功能模式', 'interaction_entry.website_modes_remain_internal');
  }

  const policy = book?.content_policy;
  const acquisition = policy?.source_acquisition;
  const staticTypes = ['score_website', 'score_image', 'score_pdf', 'musicxml', 'other_static_score_file'];
  const webTypes = ['score_website', 'score_image', 'score_pdf', 'musicxml'];
  const forbidden = ['youtube', 'video', 'audio_recording', 'memory_only'];

  if (!hasAll(acquisition?.accepted_routes?.user_provided, staticTypes)) {
    fail('source-route-user', '使用者提供來源必須支援網站、圖片、PDF、MusicXML 與其他靜態樂譜檔', 'content_policy.source_acquisition.accepted_routes.user_provided');
  }
  if (!hasAll(acquisition?.accepted_routes?.assistant_web_research, webTypes)) {
    fail('source-route-web', '網路研究必須找到可檢視的靜態樂譜或 MusicXML', 'content_policy.source_acquisition.accepted_routes.assistant_web_research');
  }
  for (const field of [
    'primary_source_must_be_inspectable_static_notation',
    'user_provided_source_has_variant_priority',
    'assistant_must_fix_exact_source_before_transcription',
    'stop_when_no_verifiable_static_source',
  ]) {
    if (acquisition?.[field] !== true) {
      fail('source-acquisition-policy', `${field} 必須是 true`, `content_policy.source_acquisition.${field}`);
    }
  }
  if (!hasAll(acquisition?.forbidden_transcription_or_verification_sources, forbidden)) {
    fail('forbidden-source-policy', 'YouTube、影片、音訊與記憶不得用於轉錄或驗證', 'content_policy.source_acquisition.forbidden_transcription_or_verification_sources');
  }
  if (!hasAll(policy?.source_types, staticTypes)) {
    fail('source-types', 'source_types 必須只列可檢視的靜態樂譜來源', 'content_policy.source_types');
  }
  if (!hasAll(policy?.source_providers, ['user', 'assistant_web_research'])) {
    fail('source-providers', '來源提供者只能是使用者或助理網路研究', 'content_policy.source_providers');
  }

  const requiredSourceFields = policy?.source_requirements ?? [];
  const requiredVerificationFields = policy?.verification_requirements ?? [];
  const allowedTypes = new Set(policy?.source_types ?? []);
  const allowedProviders = new Set(policy?.source_providers ?? []);

  for (const [songIndex, song] of (book?.library?.songs ?? []).entries()) {
    const base = `library.songs[${songIndex}]`;
    const source = song?.source;
    if (!isObject(source)) {
      fail('source-object', '公開曲目必須有 source 物件', `${base}.source`);
      continue;
    }
    for (const field of requiredSourceFields) {
      if (!isPresent(source[field])) {
        fail('source-field', `公開曲目缺少來源欄位 ${field}`, `${base}.source.${field}`);
      }
    }
    if (!allowedTypes.has(source.source_type)) {
      fail('source-type', `不接受來源類型 ${source.source_type ?? '(missing)'}`, `${base}.source.source_type`);
    }
    if (!allowedProviders.has(source.provided_by)) {
      fail('source-provider', `不接受來源提供者 ${source.provided_by ?? '(missing)'}`, `${base}.source.provided_by`);
    }

    const hasUrl = typeof source.url === 'string' && source.url.length > 0;
    const hasFile = typeof source.file_reference === 'string' && source.file_reference.length > 0;
    if (!hasUrl && !hasFile) {
      fail('source-locator', '來源至少需要 HTTPS URL 或檔案參照', `${base}.source`);
    }
    if (hasUrl && !/^https:\/\//.test(source.url)) {
      fail('source-url', '來源 URL 必須使用 HTTPS', `${base}.source.url`);
    }
    if (hasFile && !/^[0-9a-f]{64}$/i.test(source.content_sha256 ?? '')) {
      fail('source-file-hash', '檔案來源必須記錄 64 位 SHA-256', `${base}.source.content_sha256`);
    }

    for (const field of requiredVerificationFields) {
      if (song?.verification?.[field] !== true) {
        fail('verification-field', `公開曲目 verification.${field} 必須是 true`, `${base}.verification.${field}`);
      }
    }
  }

  for (const step of [
    'classify_request_inside_single_project',
    'acquire_static_score_from_user_or_web_if_content_request',
    'stop_if_no_verifiable_static_score',
  ]) {
    if (!(book?.workflow ?? []).includes(step)) {
      fail('workflow-step', `workflow 缺少 ${step}`, 'workflow');
    }
  }

  for (const gate of ['content', 'source']) {
    if (book?.gates?.[gate]?.required !== true) {
      fail('required-gate', `${gate} Gate 必須啟用`, `gates.${gate}.required`);
    }
  }

  return {
    pass: errors.length === 0,
    errors,
    warnings,
    counts: {
      checkedSongs: book?.library?.songs?.length ?? 0,
    },
  };
}
