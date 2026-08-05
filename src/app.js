import { splitEvents } from './layout.js';

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
    octave: match[2] === '^' ? 1 : match[2] === '_' ? -1 : 0,
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

function createNoteBox(event, palette) {
  const { degree, suffix } = parsePitch(event.pitch);
  const color = palette[String(degree)].hex;
  const box = document.createElement('span');
  box.className = 'note-box';
  box.dataset.pitch = event.pitch;
  box.style.setProperty('--note-color', color);
  box.setAttribute('aria-label', `${suffix === '^' ? '高音' : suffix === '_' ? '低音' : ''}${degree}`);

  const upper = createOctaveDot('upper', suffix === '^');
  const number = document.createElement('span');
  number.className = 'note-number';
  number.textContent = String(degree);
  const lower = createOctaveDot('lower', suffix === '_');

  box.append(upper, number, lower);
  return box;
}

function createEvent(event, palette) {
  const cell = document.createElement('div');
  cell.className = 'event';
  cell.dataset.pitch = event.pitch;
  cell.dataset.duration = String(event.duration);

  const notation = document.createElement('div');
  notation.className = 'event__notation';
  notation.append(createNoteBox(event, palette));

  const extensions = document.createElement('span');
  extensions.className = 'extensions';
  if (event.duration > 1) {
    extensions.setAttribute('aria-label', `延長 ${event.duration - 1} 單位`);
    extensions.textContent = Array.from({ length: event.duration - 1 }, () => '—').join('');
  } else {
    extensions.setAttribute('aria-hidden', 'true');
  }
  notation.append(extensions);

  const lyric = document.createElement('span');
  lyric.className = 'lyric';
  lyric.textContent = event.lyric;
  notation.append(lyric);

  cell.append(notation);
  if (event.bar_after) {
    const bar = document.createElement('span');
    bar.className = 'barline';
    bar.setAttribute('aria-hidden', 'true');
    cell.append(bar);
  }
  return cell;
}

function pitchStep(token) {
  const { degree, octave } = parsePitch(token);
  return octave * 7 + degree - 1;
}

function createStaff(events) {
  const width = 960;
  const height = 108;
  const left = 44;
  const right = 24;
  const staffTop = 28;
  const staffGap = 9;
  const usable = width - left - right;
  const totalDuration = events.reduce((sum, event) => sum + event.duration, 0);
  const unit = usable / Math.max(totalDuration, 1);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('staff-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '由相同音符資料產生的五線譜對照');

  for (let line = 0; line < 5; line += 1) {
    const y = staffTop + line * staffGap;
    const staffLine = document.createElementNS(ns, 'line');
    staffLine.setAttribute('x1', left);
    staffLine.setAttribute('x2', width - right);
    staffLine.setAttribute('y1', y);
    staffLine.setAttribute('y2', y);
    staffLine.setAttribute('class', 'staff-line');
    svg.append(staffLine);
  }

  const label = document.createElementNS(ns, 'text');
  label.setAttribute('x', '10');
  label.setAttribute('y', '59');
  label.setAttribute('class', 'staff-clef');
  label.textContent = '𝄞';
  svg.append(label);

  let elapsed = 0;
  for (const event of events) {
    const x = left + elapsed * unit + Math.max(event.duration * unit * 0.5, 8);
    const step = pitchStep(event.pitch);
    const y = 62 - step * 4.4;

    for (let ledgerY = 19; y < ledgerY; ledgerY -= staffGap) {
      const ledger = document.createElementNS(ns, 'line');
      ledger.setAttribute('x1', x - 12);
      ledger.setAttribute('x2', x + 12);
      ledger.setAttribute('y1', ledgerY);
      ledger.setAttribute('y2', ledgerY);
      ledger.setAttribute('class', 'ledger-line');
      svg.append(ledger);
    }
    for (let ledgerY = 73; y > ledgerY; ledgerY += staffGap) {
      const ledger = document.createElementNS(ns, 'line');
      ledger.setAttribute('x1', x - 12);
      ledger.setAttribute('x2', x + 12);
      ledger.setAttribute('y1', ledgerY);
      ledger.setAttribute('y2', ledgerY);
      ledger.setAttribute('class', 'ledger-line');
      svg.append(ledger);
    }

    const note = document.createElementNS(ns, 'ellipse');
    note.setAttribute('cx', x);
    note.setAttribute('cy', y);
    note.setAttribute('rx', '8');
    note.setAttribute('ry', '5.5');
    note.setAttribute('class', event.duration >= 4 ? 'staff-note staff-note--open' : 'staff-note');
    note.dataset.pitch = event.pitch;
    note.dataset.duration = String(event.duration);
    svg.append(note);

    if (event.duration < 4) {
      const stem = document.createElementNS(ns, 'line');
      stem.setAttribute('x1', x + 7);
      stem.setAttribute('x2', x + 7);
      stem.setAttribute('y1', y);
      stem.setAttribute('y2', y - 25);
      stem.setAttribute('class', 'staff-stem');
      svg.append(stem);
    }

    elapsed += event.duration;
    if (event.bar_after) {
      const barX = left + elapsed * unit;
      const bar = document.createElementNS(ns, 'line');
      bar.setAttribute('x1', barX);
      bar.setAttribute('x2', barX);
      bar.setAttribute('y1', staffTop);
      bar.setAttribute('y2', staffTop + staffGap * 4);
      bar.setAttribute('class', 'staff-barline');
      svg.append(bar);
    }
  }
  return svg;
}

function createSystem(events, palette, phraseNumber, systemNumber) {
  const section = document.createElement('section');
  section.className = 'phrase-system';
  section.dataset.phrase = String(phraseNumber);
  section.dataset.system = String(systemNumber);
  section.dataset.eventCount = String(events.length);

  const row = document.createElement('div');
  row.className = 'note-row';
  row.style.setProperty('--event-count', String(events.length));
  events.forEach((event) => row.append(createEvent(event, palette)));
  section.append(row);

  const staff = document.createElement('div');
  staff.className = 'staff-panel';
  staff.append(createStaff(events));
  section.append(staff);
  return section;
}

function renderSong(song, palette, layout, pageNumber) {
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
    for (const events of splitEvents(phrase.events, layout.notation_system.max_events_per_system)) {
      systems.append(createSystem(events, palette, phraseIndex + 1, systemNumber));
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
    const readySongs = book.songs.filter((item) => item.status === 'ready');

    readySongs.forEach((song, index) => {
      const link = document.createElement('a');
      link.href = `#${song.id}`;
      link.textContent = song.title;
      songNav.append(link);
      app.append(renderSong(song, book.palette, book.layout, index + 1));
    });

    fitAllPages();
    const version = document.querySelector('meta[name="scorebook-version"]').content;
    const hash = document.querySelector('meta[name="scorebook-sha256"]').content.slice(0, 12);
    status.textContent = `必要 Gate PASS · ${readySongs.length} 首已載入 · 規格 ${version} (${hash})`;
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
