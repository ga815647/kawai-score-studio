import { ScorePlayer } from './audio.js';
import { flattenMeasures } from './score-engine.js';
import { renderScore } from './staff-renderer.js';

const STORAGE_KEY = 'kawai-score-studio:draft:v2';
const player = new ScorePlayer();

const status = document.querySelector('#status');
const libraryTab = document.querySelector('#library-tab');
const studioTab = document.querySelector('#studio-tab');
const libraryView = document.querySelector('#library-view');
const studioView = document.querySelector('#studio-view');
const libraryContent = document.querySelector('#library-content');
const quarantineList = document.querySelector('#quarantine-list');
const draftEditor = document.querySelector('#draft-editor');
const draftFile = document.querySelector('#draft-file');
const scorePage = document.querySelector('#score-page');
const scoreTitle = document.querySelector('#score-title');
const scoreMeta = document.querySelector('#score-meta');
const scoreBadge = document.querySelector('#score-badge');
const scoreRender = document.querySelector('#score-render');

let book;
let fixtureBook;
let activeDraft;

function setMode(mode) {
  const studio = mode === 'studio';
  libraryView.hidden = studio;
  studioView.hidden = !studio;
  libraryTab.setAttribute('aria-selected', String(!studio));
  studioTab.setAttribute('aria-selected', String(studio));
  document.body.dataset.mode = mode;
}

libraryTab.addEventListener('click', () => setMode('library'));
studioTab.addEventListener('click', () => setMode('studio'));

function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  status.textContent = `FAIL · ${message}`;
  status.className = 'status status--fail';
}

function validateDraft(score) {
  if (!score || typeof score !== 'object') throw new Error('草稿必須是 JSON 物件');
  if (!score.id || !score.title || !score.key || !score.meter) throw new Error('草稿缺少 id、title、key 或 meter');
  if (!Array.isArray(score.measures) || score.measures.length === 0) throw new Error('草稿需要 measures');
  if (!Array.isArray(score.lyric_tracks) || score.lyric_tracks.length === 0) throw new Error('草稿需要獨立 lyric_tracks');

  const ids = new Set();
  for (const event of flattenMeasures(score)) {
    if (!event.id || ids.has(event.id)) throw new Error(`event id 缺少或重複：${event.id ?? ''}`);
    ids.add(event.id);
    if (!['note', 'rest'].includes(event.kind)) throw new Error(`${event.id} kind 必須是 note 或 rest`);
    if (!Number.isInteger(event.duration) || event.duration <= 0) throw new Error(`${event.id} duration 必須是正整數`);
    if ('lyric' in event || 'text' in event) throw new Error(`${event.id} 不可內嵌歌詞`);
    if (event.kind === 'note' && !event.pitch) throw new Error(`${event.id} note 缺少 pitch`);
    if (event.kind === 'rest' && 'pitch' in event) throw new Error(`${event.id} rest 不可有 pitch`);
  }

  const defaultTracks = score.lyric_tracks.filter((track) => track.default === true);
  if (defaultTracks.length !== 1) throw new Error('草稿必須恰好有一個 default lyric track');
  for (const track of score.lyric_tracks) {
    for (const syllable of track.syllables ?? []) {
      if (!ids.has(syllable.event)) throw new Error(`歌詞指向不存在的 event：${syllable.event}`);
    }
  }
  return score;
}

function setEditorScore(score) {
  draftEditor.value = `${JSON.stringify(score, null, 2)}\n`;
}

function renderDraft(score) {
  activeDraft = validateDraft(score);
  scoreTitle.textContent = activeDraft.title;
  scoreMeta.textContent = `${activeDraft.meter} · ${activeDraft.key} · ${activeDraft.lyric_tracks.find((track) => track.default)?.locale ?? ''}`;
  scoreBadge.textContent = activeDraft.synthetic === true ? 'SYNTHETIC FIXTURE' : 'LOCAL DRAFT';
  scorePage.dataset.scoreId = activeDraft.id;
  scorePage.dataset.synthetic = String(activeDraft.synthetic === true);
  renderScore(scoreRender, activeDraft, book.palette, {
    geometry: book.layout.system_geometry,
    systemBreaking: book.layout.system_breaking,
    typography: book.layout.typography,
  });
  status.textContent = `Studio READY · 本機預覽與播放不需要 GitHub · ${activeDraft.title}`;
  status.className = 'status status--pass';
}

function applyEditorDraft() {
  const parsed = JSON.parse(draftEditor.value);
  renderDraft(parsed);
}

function renderLibrary() {
  libraryContent.replaceChildren();
  quarantineList.replaceChildren();
  const songs = book.library.songs;
  if (songs.length === 0) {
    const template = document.querySelector('#empty-library-template');
    libraryContent.append(template.content.cloneNode(true));
  } else {
    for (const song of songs) {
      const card = document.createElement('article');
      card.className = 'library-song';
      card.dataset.scoreId = song.id;
      const heading = document.createElement('h3');
      heading.textContent = song.alias ? `${song.title}（${song.alias}）` : song.title;
      const meta = document.createElement('p');
      meta.textContent = `${song.meter} · ${song.key} · verified`;
      const score = document.createElement('div');
      score.className = 'score-render';
      card.append(heading, meta, score);
      libraryContent.append(card);
      renderScore(score, song, book.palette, {
        geometry: book.layout.system_geometry,
        systemBreaking: book.layout.system_breaking,
        typography: book.layout.typography,
      });
    }
  }

  for (const item of book.library.quarantine) {
    const li = document.createElement('li');
    const label = item.alias ? `${item.title}（${item.alias}）` : item.title;
    li.textContent = `${label}：${item.reason}`;
    quarantineList.append(li);
  }
}

document.querySelector('#load-fixture').addEventListener('click', () => {
  const fixture = structuredClone(fixtureBook.fixtures[0]);
  setEditorScore(fixture);
  renderDraft(fixture);
});

document.querySelector('#apply-draft').addEventListener('click', () => {
  try { applyEditorDraft(); } catch (error) { showError(error); }
});

document.querySelector('#save-draft').addEventListener('click', () => {
  try {
    const parsed = validateDraft(JSON.parse(draftEditor.value));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    status.textContent = '本機草稿已儲存；沒有上傳 GitHub';
    status.className = 'status status--pass';
  } catch (error) { showError(error); }
});

document.querySelector('#clear-draft').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  const fixture = structuredClone(fixtureBook.fixtures[0]);
  setEditorScore(fixture);
  renderDraft(fixture);
});

draftFile.addEventListener('change', async () => {
  try {
    const file = draftFile.files?.[0];
    if (!file) return;
    const parsed = validateDraft(JSON.parse(await file.text()));
    setEditorScore(parsed);
    renderDraft(parsed);
  } catch (error) { showError(error); }
  finally { draftFile.value = ''; }
});

document.querySelector('#play-score').addEventListener('click', async () => {
  try {
    if (!activeDraft) applyEditorDraft();
    await player.play(activeDraft);
    status.textContent = `正在本機播放：${activeDraft.title}`;
    status.className = 'status status--pass';
  } catch (error) { showError(error); }
});

document.querySelector('#stop-score').addEventListener('click', () => {
  player.stop();
  status.textContent = '播放已停止';
  status.className = 'status status--pass';
});

document.querySelector('#print-score').addEventListener('click', () => window.print());
window.addEventListener('beforeunload', () => player.stop());

async function start() {
  try {
    const [bookResponse, fixtureResponse] = await Promise.all([
      fetch('./scorebook.json', { cache: 'no-store' }),
      fetch('./fixtures.json', { cache: 'no-store' }),
    ]);
    if (!bookResponse.ok || !fixtureResponse.ok) throw new Error('無法載入建置資料');
    book = await bookResponse.json();
    fixtureBook = await fixtureResponse.json();
    if (globalThis.VexFlow?.BUILD?.VERSION !== book.rendering.staff.version) {
      throw new Error('VexFlow 版本與正式規格不符');
    }
    globalThis.VexFlow.setFonts('Bravura', 'Academico');

    const parameters = new URLSearchParams(location.search);
    if (!parameters.has('fixture')) renderLibrary();

    let initialDraft = structuredClone(fixtureBook.fixtures[0]);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { initialDraft = validateDraft(JSON.parse(saved)); } catch { localStorage.removeItem(STORAGE_KEY); }
    }
    setEditorScore(initialDraft);
    renderDraft(initialDraft);

    setMode(parameters.has('studio') || parameters.has('fixture') ? 'studio' : 'library');
    const version = document.querySelector('meta[name="scorebook-version"]').content;
    const hash = document.querySelector('meta[name="scorebook-sha256"]').content.slice(0, 12);
    status.textContent = `PASS · 正式曲目 ${book.library.songs.length} 首 · 隔離 ${book.library.quarantine.length} 首 · 規格 ${version} (${hash})`;
    status.className = 'status status--pass';
  } catch (error) {
    showError(error);
    const template = document.querySelector('#error-template');
    const card = template.content.cloneNode(true);
    card.querySelector('pre').textContent = error instanceof Error ? error.stack : String(error);
    document.querySelector('main').append(card);
  }
}

start();
