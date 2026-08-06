import { ScorePlayer } from './audio.js';
import { renderScore } from './staff-renderer.js';

const player = new ScorePlayer();
const status = document.querySelector('#status');
const libraryView = document.querySelector('#library-view');
const libraryContent = document.querySelector('#library-content');
const quarantinePanel = document.querySelector('#quarantine-panel');
const quarantineList = document.querySelector('#quarantine-list');
const fixtureView = document.querySelector('#studio-view');
const fixturePage = document.querySelector('#score-page');
const fixtureTitle = document.querySelector('#score-title');
const fixtureMeta = document.querySelector('#score-meta');
const fixtureBadge = document.querySelector('#score-badge');
const fixtureRender = document.querySelector('#score-render');

let book;
let fixtureBook;
let activePrintCard;

function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  status.textContent = `FAIL · ${message}`;
  status.className = 'status status--fail';
}

function scoreLabel(score) {
  return score.alias ? `${score.title}（${score.alias}）` : score.title;
}

function renderOptions() {
  return {
    geometry: book.layout.system_geometry,
    systemBreaking: book.layout.system_breaking,
    typography: book.layout.typography,
  };
}

function setReady(message) {
  status.textContent = message;
  status.className = 'status status--pass';
}

function cleanupPrintTarget() {
  activePrintCard?.classList.remove('print-selected');
  activePrintCard = undefined;
  document.body.classList.remove('printing-selected-song');
  delete document.body.dataset.printScoreId;
}

function selectForPrint(card) {
  cleanupPrintTarget();
  activePrintCard = card;
  card.classList.add('print-selected');
  document.body.classList.add('printing-selected-song');
  document.body.dataset.printScoreId = card.dataset.scoreId;
}

function createButton(action, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function createLibraryCard(song) {
  const card = document.createElement('article');
  card.className = 'library-song';
  card.dataset.scoreId = song.id;

  const controls = document.createElement('div');
  controls.className = 'song-controls';
  controls.setAttribute('aria-label', `${scoreLabel(song)}操作`);
  controls.append(
    createButton('play', '播放'),
    createButton('stop', '停止'),
    createButton('print', '列印'),
  );

  const page = document.createElement('section');
  page.className = 'score-page library-score-page';
  page.dataset.scoreId = song.id;
  page.dataset.synthetic = 'false';

  const header = document.createElement('header');
  header.className = 'score-header';
  const badge = document.createElement('p');
  badge.className = 'score-badge';
  badge.textContent = 'VERIFIED LIBRARY';
  const heading = document.createElement('h3');
  heading.textContent = scoreLabel(song);
  const meta = document.createElement('p');
  const locale = song.lyric_tracks.find((track) => track.default)?.locale ?? '';
  meta.textContent = `${song.meter} · ${song.key} · ${locale}`;
  header.append(badge, heading, meta);

  const score = document.createElement('div');
  score.className = 'score-render';
  page.append(header, score);
  card.append(controls, page);
  libraryContent.append(card);

  renderScore(score, song, book.palette, renderOptions());
  return card;
}

function renderLibrary() {
  libraryContent.replaceChildren();
  quarantineList.replaceChildren();

  for (const song of book.library.songs) createLibraryCard(song);

  for (const item of book.library.quarantine) {
    const li = document.createElement('li');
    li.textContent = `${scoreLabel(item)}：${item.reason}`;
    quarantineList.append(li);
  }
  quarantinePanel.hidden = book.library.quarantine.length === 0;
}

function renderFixture() {
  const fixture = structuredClone(fixtureBook.fixtures[0]);
  fixtureTitle.textContent = fixture.title;
  fixtureMeta.textContent = `${fixture.meter} · ${fixture.key} · ${fixture.lyric_tracks.find((track) => track.default)?.locale ?? ''}`;
  fixtureBadge.textContent = 'SYNTHETIC FIXTURE';
  fixturePage.dataset.scoreId = fixture.id;
  fixturePage.dataset.synthetic = 'true';
  renderScore(fixtureRender, fixture, book.palette, renderOptions());
}

libraryContent.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  const card = button?.closest('.library-song');
  if (!button || !card) return;
  const song = book.library.songs.find((item) => item.id === card.dataset.scoreId);
  if (!song) return;

  try {
    switch (button.dataset.action) {
      case 'play':
        await player.play(song);
        setReady(`正在本機播放：${scoreLabel(song)}`);
        break;
      case 'stop':
        player.stop();
        setReady(`播放已停止：${scoreLabel(song)}`);
        break;
      case 'print':
        player.stop();
        selectForPrint(card);
        setReady(`準備列印：${scoreLabel(song)} · A4 直式`);
        requestAnimationFrame(() => window.print());
        break;
      default:
        break;
    }
  } catch (error) {
    showError(error);
  }
});

window.addEventListener('afterprint', cleanupPrintTarget);
window.addEventListener('beforeunload', () => player.stop());

async function start() {
  try {
    const parameters = new URLSearchParams(location.search);
    const fixtureMode = parameters.has('fixture');
    const requests = [fetch('./scorebook.json', { cache: 'no-store' })];
    if (fixtureMode) requests.push(fetch('./fixtures.json', { cache: 'no-store' }));
    const responses = await Promise.all(requests);
    if (responses.some((response) => !response.ok)) throw new Error('無法載入建置資料');

    book = await responses[0].json();
    fixtureBook = fixtureMode ? await responses[1].json() : undefined;
    if (globalThis.VexFlow?.BUILD?.VERSION !== book.rendering.staff.version) {
      throw new Error('VexFlow 版本與正式規格不符');
    }
    globalThis.VexFlow.setFonts('Bravura', 'Academico');

    if (fixtureMode) {
      libraryView.hidden = true;
      fixtureView.hidden = false;
      document.body.dataset.view = 'fixture';
      renderFixture();
      setReady('PASS · Synthetic fixture internal route');
      return;
    }

    fixtureView.hidden = true;
    libraryView.hidden = false;
    document.body.dataset.view = 'library';
    renderLibrary();
    const version = document.querySelector('meta[name="scorebook-version"]').content;
    const hash = document.querySelector('meta[name="scorebook-sha256"]').content.slice(0, 12);
    setReady(`PASS · 正式曲目 ${book.library.songs.length} 首 · 規格 ${version} (${hash})`);
  } catch (error) {
    showError(error);
    const template = document.querySelector('#error-template');
    const card = template.content.cloneNode(true);
    card.querySelector('pre').textContent = error instanceof Error ? error.stack : String(error);
    document.querySelector('main').append(card);
  }
}

start();
