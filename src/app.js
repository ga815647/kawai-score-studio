import { splitEvents } from './layout.js';
import { renderStaffSystem } from './staff-renderer.js';

const app = document.querySelector('#app');
const main = document.querySelector('main');
const status = document.querySelector('#status');
const songNav = document.querySelector('#song-nav');
const lyricsToggle = document.querySelector('#toggle-lyrics');
const staffToggle = document.querySelector('#toggle-staff');

document.querySelector('#print-button').addEventListener('click', () => window.print());
lyricsToggle.addEventListener('change', () => document.body.classList.toggle('hide-lyrics', !lyricsToggle.checked));
staffToggle.addEventListener('change', () => document.body.classList.toggle('hide-staff', !staffToggle.checked));

function parsePitch(token) {
  const match = /^([1-7])(\^|_)?$/.exec(token);
  if (!match) throw new Error(`非法音符：${token}`);
  return {
    degree: Number(match[1]),
    suffix: match[2] ?? '',
  };
}

function createOctaveDot(position, active) {
  const dot = document.createElement('span');
  dot.className = `octave-dot octave-dot--${position}`;
  dot.setAttribute('aria-hidden', 'true');
  if (active) dot.classList.add('octave-dot--active');
  return dot;
}

function createNumberedNote(event, palette, anchorX) {
  const { degree, suffix } = parsePitch(event.pitch);
  const color = palette[String(degree)].hex;
  const note = document.createElement('span');
  note.className = 'numbered-note';
  note.dataset.pitch = event.pitch;
  note.dataset.staffAnchorX = anchorX.toFixed(3);
  note.style.setProperty('--note-color', color);
  note.setAttribute('aria-label', `${suffix === '^' ? '高音' : suffix === '_' ? '低音' : ''}${degree}`);

  const upper = createOctaveDot('upper', suffix === '^');
  const number = document.createElement('span');
  number.className = 'note-number';
  number.textContent = String(degree);
  const lower = createOctaveDot('lower', suffix === '_');

  note.append(upper, number, lower);
  return note;
}

function createEvent(event, palette, anchorX, nextAnchorX, notation) {
  const cell = document.createElement('div');
  cell.className = 'event';
  cell.dataset.pitch = event.pitch;
  cell.dataset.duration = String(event.duration);
  cell.dataset.staffAnchorX = anchorX.toFixed(3);
  cell.style.left = `${anchorX}px`;
  cell.setAttribute('aria-label', `${event.lyric}，${event.pitch}，時值 ${event.duration} 個八分音符單位`);

  const notationGroup = document.createElement('div');
  notationGroup.className = 'event__notation';
  notationGroup.dataset.staffAnchorX = anchorX.toFixed(3);
  notationGroup.append(createNumberedNote(event, palette, anchorX));

  const lyric = document.createElement('span');
  lyric.className = 'lyric';
  lyric.dataset.staffAnchorX = anchorX.toFixed(3);
  lyric.textContent = event.lyric;
  notationGroup.append(lyric);

  cell.append(notationGroup);
  if (event.bar_after) {
    const noteWidth = notation.numbered_note.width_px;
    const nextX = nextAnchorX ?? (anchorX + noteWidth * 1.5);
    const anchorDelta = Math.max(0, nextX - anchorX);
    const bar = document.createElement('span');
    bar.className = 'barline';
    bar.style.left = `${noteWidth / 2 + anchorDelta / 2}px`;
    bar.setAttribute('aria-hidden', 'true');
    cell.append(bar);
  }
  return cell;
}

function assertSharedAnchors(row, anchors, tolerance) {
  const events = [...row.querySelectorAll('.event')];
  if (events.length !== anchors.length) {
    throw new Error(`簡譜 event 數 ${events.length} 與 staff anchor 數 ${anchors.length} 不符`);
  }

  events.forEach((eventElement, index) => {
    const expected = anchors[index];
    const eventX = Number.parseFloat(eventElement.style.left);
    const numberX = Number(eventElement.querySelector('.numbered-note').dataset.staffAnchorX);
    const lyricX = Number(eventElement.querySelector('.lyric').dataset.staffAnchorX);
    if (
      Math.abs(eventX - expected) > tolerance
      || Math.abs(numberX - expected) > tolerance
      || Math.abs(lyricX - expected) > tolerance
    ) {
      throw new Error(`第 ${index + 1} 顆音未與五線譜音頭中心對齊`);
    }
  });
}

function createSystem(events, song, palette, layout, notation, phraseNumber, systemNumber) {
  const section = document.createElement('section');
  section.className = 'phrase-system';
  section.dataset.phrase = String(phraseNumber);
  section.dataset.system = String(systemNumber);
  section.dataset.eventCount = String(events.length);

  const row = document.createElement('div');
  row.className = 'note-row';
  row.setAttribute('aria-label', `第 ${systemNumber} 譜行彩色簡譜與歌詞`);

  const staff = document.createElement('div');
  staff.className = 'staff-panel';
  const { anchors } = renderStaffSystem(staff, events, song, layout, {
    showTimeSignature: systemNumber === 1,
  });

  anchors.forEach((anchorX, index) => {
    row.append(createEvent(
      events[index],
      palette,
      anchorX,
      anchors[index + 1],
      notation,
    ));
  });
  row.dataset.staffAnchors = anchors.map((value) => value.toFixed(3)).join(',');
  assertSharedAnchors(row, anchors, layout.notation_system.alignment.tolerance_px);

  section.append(row, staff);
  return section;
}

function renderSong(song, book, pageNumber) {
  const viewport = document.createElement('div');
  viewport.className = 'page-viewport';
  viewport.id = song.id;

  const article = document.createElement('article');
  article.className = 'song-page';
  article.dataset.songId = song.id;

  const header = document.createElement('header');
  header.className = 'song-header';

  const titleCard = document.createElement('div');
  titleCard.className = 'song-title-card';

  const kicker = document.createElement('p');
  kicker.className = 'song-kicker';
  kicker.textContent = 'KAWAI 16 音木琴';

  const heading = document.createElement('h2');
  heading.textContent = song.title;

  const source = document.createElement('p');
  source.className = 'song-source';
  source.textContent = song.source.note;

  titleCard.append(kicker, heading, source);

  const meta = document.createElement('p');
  meta.className = 'song-meta';
  meta.textContent = `${song.meter} · ${song.key}`;
  header.append(titleCard, meta);
  article.append(header);

  const systems = document.createElement('div');
  systems.className = 'song-systems';
  let systemNumber = 1;
  song.phrases.forEach((phrase, phraseIndex) => {
    for (const events of splitEvents(phrase.events, book.layout.notation_system.max_events_per_system)) {
      systems.append(createSystem(
        events,
        song,
        book.palette,
        book.layout,
        book.notation,
        phraseIndex + 1,
        systemNumber,
      ));
      systemNumber += 1;
    }
  });
  article.append(systems);

  const pageMark = document.createElement('footer');
  pageMark.className = 'page-mark';
  pageMark.setAttribute('aria-label', `第 ${pageNumber} 頁`);
  pageMark.textContent = String(pageNumber);
  article.append(pageMark);

  viewport.append(article);
  return viewport;
}

function fitPageViewport(viewport) {
  const page = viewport.querySelector('.song-page');
  page.style.transform = 'none';
  const naturalWidth = page.offsetWidth;
  const naturalHeight = page.offsetHeight;
  const availableWidth = Math.min(naturalWidth, main.clientWidth);
  const scale = naturalWidth > 0 ? Math.min(1, availableWidth / naturalWidth) : 1;

  page.style.transform = `scale(${scale})`;
  viewport.style.width = `${naturalWidth * scale}px`;
  viewport.style.height = `${naturalHeight * scale}px`;
  viewport.dataset.scale = scale.toFixed(4);
}

let resizeFrame = 0;
function fitAllPages() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    document.querySelectorAll('.page-viewport').forEach(fitPageViewport);
  });
}

window.addEventListener('resize', fitAllPages);
window.addEventListener('afterprint', fitAllPages);

async function start() {
  try {
    const response = await fetch('./scorebook.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const book = await response.json();
    await document.fonts.ready;

    const actualVexFlowVersion = globalThis.VexFlow?.BUILD?.VERSION;
    if (actualVexFlowVersion !== book.rendering.staff.version) {
      throw new Error(`VexFlow 載入版本 ${actualVexFlowVersion ?? 'unknown'} 不符合規格 ${book.rendering.staff.version}`);
    }
    globalThis.VexFlow.setFonts('Bravura', 'Academico');

    const readySongs = book.songs.filter((item) => item.status === 'ready');
    readySongs.forEach((song, index) => {
      const link = document.createElement('a');
      link.href = `#${song.id}`;
      link.textContent = song.title;
      songNav.append(link);
      app.append(renderSong(song, book, index + 1));
    });

    fitAllPages();
    const version = document.querySelector('meta[name="scorebook-version"]').content;
    const hash = document.querySelector('meta[name="scorebook-sha256"]').content.slice(0, 12);
    status.textContent = `必要 Gate PASS · ${readySongs.length} 首已載入 · VexFlow ${actualVexFlowVersion} · 規格 ${version} (${hash})`;
    status.classList.add('status--pass');
  } catch (error) {
    status.textContent = '載入失敗';
    status.classList.add('status--fail');
    const template = document.querySelector('#error-template');
    const card = template.content.cloneNode(true);
    card.querySelector('pre').textContent = error instanceof Error ? error.stack : String(error);
    app.append(card);
  }
}

start();
