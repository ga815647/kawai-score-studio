import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const reportDirectory = 'reports/visual';
const minimumLyricGapPx = 8;
const maximumHorizontalShiftPx = 24;

const songs = [
  { id: 'hickory-dickory-dock', title: 'Hickory Dickory Dock', notes: 30, lyrics: 28 },
  { id: 'itsy-bitsy-spider', title: 'The Itsy Bitsy Spider', notes: 47, lyrics: 47 },
  { id: 'twinkle-twinkle-little-star-zh', title: '小星星', notes: 42, lyrics: 42 },
  { id: 'two-tigers-zh', title: '兩隻老虎', notes: 32, lyrics: 32 },
  { id: 'old-macdonald-zh', title: '王老先生有塊地', notes: 58, lyrics: 58 },
  { id: 'mary-had-a-little-lamb-zh', title: '瑪麗有隻小綿羊', notes: 25, lyrics: 25 },
  { id: 'happy-birthday-zh', title: '生日快樂', notes: 25, lyrics: 24 },
];

test('library-only site renders directory, all verified songs, explicit A4 controls, and no public Studio or quarantine panel', async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(reportDirectory, { recursive: true });
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('.status--pass')).toBeVisible();
  await expect(page.locator('.status--pass')).toContainText('規格 0.6.15');
  await expect(page.locator('.status--pass')).not.toContainText('隔離');
  await expect(page.locator('#song-directory')).toBeVisible();
  await expect(page.locator('#library-view')).toBeVisible();
  await expect(page.locator('#studio-view')).toBeHidden();
  await expect(page.locator('#fixture-view')).toBeHidden();
  await expect(page.locator('#studio-tab, #draft-editor')).toHaveCount(0);
  await expect(page.locator('#quarantine-panel, #quarantine-list')).toHaveCount(0);
  await expect(page.locator('main > .error-card')).toHaveCount(0);
  await expect(page.locator('.library-song')).toHaveCount(7);
  await expect(page.locator('#song-directory-list > li')).toHaveCount(7);

  const assetUrls = await page.evaluate(() => ({
    scripts: [...document.scripts].map((script) => script.getAttribute('src')).filter(Boolean),
    styles: [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map((link) => link.getAttribute('href')),
  }));
  expect(assetUrls.scripts.every((url) => url.includes('?v=0.6.15-'))).toBe(true);
  expect(assetUrls.styles.every((url) => url.includes('?v=0.6.15-'))).toBe(true);

  const reports = [];
  for (const song of songs) {
    const anchor = `#song-${song.id}`;
    const directoryLink = page.locator(`#song-directory-list a[href="${anchor}"]`);
    const card = page.locator(`.library-song[data-score-id="${song.id}"]`);

    await expect(directoryLink).toBeVisible();
    await expect(directoryLink).toContainText(song.title);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('id', `song-${song.id}`);
    await expect(card.locator('.score-header h3')).toContainText(song.title);
    await expect(card.locator('.song-controls button')).toHaveCount(3);
    await expect(card.locator('button[data-action="play"]')).toHaveText('播放');
    await expect(card.locator('button[data-action="stop"]')).toHaveText('停止');
    await expect(card.locator('button[data-action="print"]')).toHaveText('A4 列印');
    await expect(card.locator('.numbered-note')).toHaveCount(song.notes);
    await expect(card.locator('.score-lyric')).toHaveCount(song.lyrics);

    const systems = card.locator('.score-system');
    const systemCount = await systems.count();
    expect(systemCount).toBeGreaterThan(0);

    const lyricSpacing = await systems.evaluateAll((elements, minimumGap) => elements.map((system) => {
      const lyricRow = system.querySelector('.lyric-row');
      if (!lyricRow) throw new Error(`System ${system.dataset.system} has no lyric row`);
      const lyricRowRect = lyricRow.getBoundingClientRect();
      const lyrics = [...system.querySelectorAll('.score-lyric')]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            eventId: element.dataset.lyricEventId,
            left: rect.left,
            right: rect.right,
            center: (rect.left + rect.right) / 2,
            staffCenterX: Number(element.dataset.staffCenterX),
            horizontalShiftPx: Number(element.dataset.horizontalShiftPx ?? 0),
          };
        })
        .sort((left, right) => left.left - right.left);
      const gaps = lyrics.slice(1).map((lyric, index) => ({
        leftEvent: lyrics[index].eventId,
        rightEvent: lyric.eventId,
        gapPx: lyric.left - lyrics[index].right,
      }));
      return {
        system: Number(system.dataset.system),
        minimumGapPx: gaps.length > 0 ? Math.min(...gaps.map((gap) => gap.gapPx)) : null,
        maximumHorizontalShiftPx: Number(system.dataset.maximumHorizontalShift ?? 0),
        centerErrorsPx: lyrics.map((lyric) => ({
          eventId: lyric.eventId,
          errorPx: lyric.center - lyricRowRect.left - lyric.staffCenterX,
        })),
        gaps,
        pass: gaps.every((gap) => gap.gapPx >= minimumGap - 0.01),
      };
    }), minimumLyricGapPx);

    expect(lyricSpacing.every((system) => system.pass)).toBe(true);
    expect(lyricSpacing.every(
      (system) => system.maximumHorizontalShiftPx <= maximumHorizontalShiftPx + 0.01,
    )).toBe(true);
    expect(lyricSpacing.flatMap(
      (system) => system.centerErrorsPx,
    ).every((entry) => Math.abs(entry.errorPx) <= 0.1)).toBe(true);

    const overflow = await card.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    reports.push({ ...song, systemCount, lyricSpacing, overflow });
  }

  const lastSong = songs.at(-1);
  const lastLink = page.locator(`#song-directory-list a[href="#song-${lastSong.id}"]`);
  await lastLink.click();
  await expect(page).toHaveURL(new RegExp(`#song-${lastSong.id}$`));
  await expect(page.locator(`#song-${lastSong.id}`)).toBeFocused();

  await page.locator('#song-directory').screenshot({
    path: `${reportDirectory}/song-directory.png`,
    animations: 'disabled',
    caret: 'hide',
  });

  const spider = page.locator('.library-song[data-score-id="itsy-bitsy-spider"]');
  await spider.screenshot({
    path: `${reportDirectory}/itsy-bitsy-spider-library.png`,
    animations: 'disabled',
    caret: 'hide',
  });

  await writeFile(
    `${reportDirectory}/verified-library-report.json`,
    `${JSON.stringify({
      pass: true,
      headSha: process.env.GITHUB_SHA ?? null,
      minimumLyricGapPx,
      maximumHorizontalShiftPx,
      directoryEntries: songs.map((song) => ({
        id: song.id,
        href: `#song-${song.id}`,
      })),
      assetUrls,
      songs: reports,
      screenshots: ['song-directory.png', 'itsy-bitsy-spider-library.png'],
    }, null, 2)}\n`,
  );
});


test('stale cached index automatically reloads with the current build hash', async ({ page }) => {
  const [indexHtml, buildInfoText] = await Promise.all([
    readFile('dist/index.html', 'utf8'),
    readFile('dist/build-info.json', 'utf8'),
  ]);
  const buildInfo = JSON.parse(buildInfoText);
  const buildKey = buildInfo.scorebook_sha256.slice(0, 12);
  let staleDocumentServed = false;

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      request.resourceType() === 'document'
      && !staleDocumentServed
      && !url.searchParams.has('build')
    ) {
      staleDocumentServed = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: indexHtml.replace(
          /(<meta name="scorebook-sha256" content=")[^"]+(">)/,
          `$1${'0'.repeat(64)}$2`,
        ),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.status--pass')).toBeVisible();
  await expect(page.locator('.status--pass')).toContainText(`規格 ${buildInfo.version} (${buildKey})`);
  expect(new URL(page.url()).searchParams.get('build')).toBe(buildKey);
  expect(staleDocumentServed).toBe(true);
});

test('selected-song print produces readable A4 output and never prints the fixture, directory, or other songs', async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(reportDirectory, { recursive: true });
  await page.addInitScript(() => {
    window.print = () => { window.__printCalled = true; };
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.status--pass')).toBeVisible();

  const target = page.locator('.library-song[data-score-id="itsy-bitsy-spider"]');
  await target.locator('button[data-action="print"]').click();
  await expect.poll(() => page.evaluate(() => window.__printCalled === true)).toBe(true);
  await expect(target).toHaveClass(/print-selected/);
  await expect(page.locator('body')).toHaveClass(/printing-selected-song/);
  await expect(page.locator('body')).toHaveAttribute('data-print-score-id', 'itsy-bitsy-spider');

  await page.emulateMedia({ media: 'print' });
  await expect(target).toBeVisible();
  for (const song of songs.filter((song) => song.id !== 'itsy-bitsy-spider')) {
    await expect(page.locator(`.library-song[data-score-id="${song.id}"]`)).toBeHidden();
  }
  await expect(page.locator('#studio-view')).toBeHidden();
  await expect(page.locator('#fixture-view')).toBeHidden();
  const hiddenPrintChrome = page.locator('.toolbar, .status, .song-directory, .view-heading, .song-controls');
  expect(await hiddenPrintChrome.evaluateAll((elements) => elements.every(
    (element) => getComputedStyle(element).display === 'none',
  ))).toBe(true);

  const printGeometry = await target.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    cardDisplay: getComputedStyle(element).display,
    pageWidth: getComputedStyle(element.querySelector('.score-page')).width,
    systems: [...element.querySelectorAll('.score-system')].map((system) => ({
      breakInside: getComputedStyle(system).breakInside,
      pageBreakInside: getComputedStyle(system).pageBreakInside,
      scrollWidth: system.scrollWidth,
      clientWidth: system.clientWidth,
    })),
  }));
  expect(printGeometry.cardDisplay).toBe('block');
  expect(printGeometry.scrollWidth).toBeLessThanOrEqual(printGeometry.clientWidth + 1);
  expect(printGeometry.systems.length).toBeGreaterThanOrEqual(2);
  expect(printGeometry.systems.every((system) => ['avoid', 'avoid-page'].includes(system.breakInside))).toBe(true);
  expect(printGeometry.systems.every((system) => system.pageBreakInside === 'avoid')).toBe(true);
  expect(printGeometry.systems.every((system) => system.scrollWidth <= system.clientWidth + 1)).toBe(true);

  await target.screenshot({
    path: `${reportDirectory}/itsy-bitsy-spider-print-a4.png`,
    animations: 'disabled',
    caret: 'hide',
  });
  await page.pdf({
    path: `${reportDirectory}/itsy-bitsy-spider-print-a4.pdf`,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });

  await writeFile(
    `${reportDirectory}/selected-song-print-report.json`,
    `${JSON.stringify({
      pass: true,
      headSha: process.env.GITHUB_SHA ?? null,
      selectedSong: 'itsy-bitsy-spider',
      directoryVisible: false,
      fixtureVisible: false,
      printGeometry,
      screenshot: 'itsy-bitsy-spider-print-a4.png',
      pdf: 'itsy-bitsy-spider-print-a4.pdf',
    }, null, 2)}\n`,
  );
});
