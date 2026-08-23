import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const reportDirectory = 'reports/visual';
const book = JSON.parse(await readFile('dist/scorebook.json', 'utf8'));
const lyricGapRange = book.gates.visual.measurements.staff_bottom_line_to_lyric_top_px;

test('Three Blind Mice print keeps lyrics below the rendered staff', async ({ page }) => {
  await mkdir(reportDirectory, { recursive: true });
  await page.addInitScript(() => {
    window.print = () => { window.__printCalled = true; };
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.status--pass')).toBeVisible();

  const target = page.locator('.library-song[data-score-id="three-blind-mice"]');
  await target.locator('button[data-action="print"]').click();
  await expect.poll(() => page.evaluate(() => window.__printCalled === true)).toBe(true);
  await expect(target).toHaveClass(/print-selected/);

  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));

  const systems = await target.locator('.score-system').evaluateAll((elements) => elements.map((system) => {
    const svg = system.querySelector('.staff-panel > svg');
    const lyrics = [...system.querySelectorAll('.score-lyric')];
    if (!(svg instanceof SVGSVGElement) || lyrics.length === 0) return null;

    const matrix = svg.getScreenCTM();
    const staffBottomLineY = Number(system.dataset.staffBottomLineY);
    if (!matrix || !Number.isFinite(staffBottomLineY)) throw new Error('Missing print staff geometry');

    const point = svg.createSVGPoint();
    point.x = 0;
    point.y = staffBottomLineY;
    const renderedStaffBottom = point.matrixTransform(matrix).y;
    const lyricMetrics = lyrics.map((lyric) => {
      const rect = lyric.getBoundingClientRect();
      return {
        eventId: lyric.dataset.lyricEventId,
        verticalShiftPx: Number(lyric.dataset.verticalShiftPx ?? 0),
        top: rect.top,
        gapPx: rect.top - renderedStaffBottom,
      };
    });
    const defaultLyrics = lyricMetrics.filter((lyric) => lyric.verticalShiftPx === 0);

    return {
      system: system.dataset.system,
      renderedStaffBottom,
      minimumLyricGapPx: Math.min(...lyricMetrics.map((lyric) => lyric.gapPx)),
      defaultLyricGapPx: defaultLyrics.length > 0
        ? Math.min(...defaultLyrics.map((lyric) => lyric.gapPx))
        : null,
      lyricMetrics,
    };
  }).filter(Boolean));

  expect(systems.length).toBeGreaterThan(0);
  expect(systems.every((system) => system.minimumLyricGapPx >= lyricGapRange.min - 0.5)).toBe(true);
  expect(systems.filter((system) => system.defaultLyricGapPx !== null).every((system) => (
    system.defaultLyricGapPx >= lyricGapRange.min - 0.5
    && system.defaultLyricGapPx <= lyricGapRange.max + 0.5
  ))).toBe(true);

  await target.screenshot({
    path: `${reportDirectory}/three-blind-mice-print-lyric-clearance.png`,
    animations: 'disabled',
    caret: 'hide',
  });
  await writeFile(
    `${reportDirectory}/print-lyric-geometry-report.json`,
    `${JSON.stringify({
      pass: true,
      headSha: process.env.GITHUB_SHA ?? null,
      selectedSong: 'three-blind-mice',
      configuredGapPx: lyricGapRange,
      systems,
      screenshot: 'three-blind-mice-print-lyric-clearance.png',
    }, null, 2)}\n`,
  );
});
