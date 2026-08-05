import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const reportDirectory = 'reports/visual';
const book = JSON.parse(await readFile('dist/scorebook.json', 'utf8'));
const visualMeasurements = book.gates.visual.measurements;

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function maximumDelta(values) {
  return values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
}

function maximumAbsolute(values) {
  return values.length > 0 ? Math.max(...values.map(Math.abs)) : 0;
}

test('fixture renders tighter numbered notation and a shared lyric baseline', async ({ page }) => {
  await mkdir(reportDirectory, { recursive: true });
  await page.goto('/?fixture=1', { waitUntil: 'networkidle' });
  await expect(page.locator('.status--pass')).toBeVisible();
  await expect(page.locator('#studio-view')).toBeVisible();
  await expect(page.locator('#score-title')).toHaveText('Synthetic Layout Fixture');
  await expect(page.locator('#score-page')).toHaveAttribute('data-synthetic', 'true');

  const systems = page.locator('.score-system');
  const systemCount = await systems.count();
  expect(systemCount).toBeGreaterThan(0);

  const measurements = [];
  for (let systemIndex = 0; systemIndex < systemCount; systemIndex += 1) {
    const system = systems.nth(systemIndex);
    const metric = await system.evaluate((element) => {
      const staff = element.querySelector('.staff-panel');
      const numbered = [...element.querySelectorAll('.numbered-note')];
      const lyrics = [...element.querySelectorAll('.score-lyric')];
      if (!(staff instanceof HTMLElement) || numbered.length === 0 || lyrics.length === 0) {
        throw new Error('system 缺少 staff、numbered notation 或 lyric');
      }

      const staffRect = staff.getBoundingClientRect();
      const topLine = staffRect.top + Number(element.dataset.staffTopLineY);
      const bottomLine = staffRect.top + Number(element.dataset.staffBottomLineY);
      const numberedRects = numbered.map((item) => item.getBoundingClientRect());
      const lyricRects = lyrics.map((item) => item.getBoundingClientRect());
      const numberBottom = Math.max(...numberedRects.map((rect) => rect.bottom));
      const lyricTop = Math.min(...lyricRects.map((rect) => rect.top));
      const lyricTops = lyricRects.map((rect) => rect.top);
      const lyricBottoms = lyricRects.map((rect) => rect.bottom);

      const numberExpectedCenters = numbered.map((item) => (
        staffRect.left + Number(item.dataset.staffCenterX)
      ));
      const lyricExpectedCenters = lyrics.map((item) => (
        staffRect.left + Number(item.dataset.staffCenterX)
      ));
      const numberCenterErrors = numberedRects.map((rect, index) => (
        (rect.left + rect.right) / 2 - numberExpectedCenters[index]
      ));
      const lyricCenterErrors = lyricRects.map((rect, index) => (
        (rect.left + rect.right) / 2 - lyricExpectedCenters[index]
      ));

      const sortedLyrics = lyricRects.slice().sort((a, b) => a.left - b.left);
      const lyricGaps = sortedLyrics.slice(1).map((rect, index) => rect.left - sortedLyrics[index].right);

      return {
        system: Number(element.dataset.system ?? 0),
        numberedCount: numbered.length,
        lyricCount: lyrics.length,
        topLine,
        bottomLine,
        numberBottom,
        lyricTop,
        numberToStaffGap: topLine - numberBottom,
        staffToLyricGap: lyricTop - bottomLine,
        maximumNumberCenterError: Math.max(...numberCenterErrors.map(Math.abs)),
        maximumLyricCenterError: Math.max(...lyricCenterErrors.map(Math.abs)),
        lyricTopDelta: Math.max(...lyricTops) - Math.min(...lyricTops),
        lyricBottomDelta: Math.max(...lyricBottoms) - Math.min(...lyricBottoms),
        minimumLyricGap: lyricGaps.length > 0 ? Math.min(...lyricGaps) : null,
      };
    });
    measurements.push(metric);
  }

  const pageOverflow = await page.locator('#score-page').evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));

  await page.locator('#score-page').screenshot({
    path: `${reportDirectory}/synthetic-fixture-a4.png`,
    animations: 'disabled',
    caret: 'hide',
  });
  await systems.first().screenshot({
    path: `${reportDirectory}/synthetic-fixture-first-system.png`,
    animations: 'disabled',
    caret: 'hide',
  });

  const numberGapRange = visualMeasurements.numbered_to_staff_top_line_gap_px;
  const lyricGapRange = visualMeasurements.staff_bottom_line_to_lyric_top_px;
  const lyricAlignmentMaximum = visualMeasurements.lyric_vertical_alignment_delta_px.max;
  const pass = measurements.every((metric) => (
    metric.numberToStaffGap >= numberGapRange.min
    && metric.numberToStaffGap <= numberGapRange.max
    && metric.staffToLyricGap >= lyricGapRange.min
    && metric.staffToLyricGap <= lyricGapRange.max
    && metric.maximumNumberCenterError <= 1
    && metric.maximumLyricCenterError <= 1
    && metric.lyricTopDelta <= lyricAlignmentMaximum
    && metric.lyricBottomDelta <= lyricAlignmentMaximum
    && (metric.minimumLyricGap === null || metric.minimumLyricGap >= 0)
  )) && pageOverflow.scrollWidth <= pageOverflow.clientWidth + 1;

  const report = {
    pass,
    headSha: process.env.GITHUB_SHA ?? null,
    fixture: 'layout-rhythm-language',
    configuredMeasurements: visualMeasurements,
    screenshots: [
      'synthetic-fixture-a4.png',
      'synthetic-fixture-first-system.png',
    ],
    measurements: measurements.map((metric) => Object.fromEntries(
      Object.entries(metric).map(([key, value]) => [key, typeof value === 'number' ? round(value) : value]),
    )),
  };
  await writeFile(`${reportDirectory}/visual-gate-report.json`, `${JSON.stringify(report, null, 2)}\n`);

  for (const metric of measurements) {
    expect(metric.numberToStaffGap, '簡譜與五線譜距離太近').toBeGreaterThanOrEqual(numberGapRange.min);
    expect(metric.numberToStaffGap, '簡譜與五線譜距離太遠').toBeLessThanOrEqual(numberGapRange.max);
    expect(metric.staffToLyricGap, '歌詞與五線譜距離太近').toBeGreaterThanOrEqual(lyricGapRange.min);
    expect(metric.staffToLyricGap, '歌詞與五線譜距離太遠').toBeLessThanOrEqual(lyricGapRange.max);
    expect(metric.maximumNumberCenterError, '簡譜中心必須對準音頭').toBeLessThanOrEqual(1);
    expect(metric.maximumLyricCenterError, '歌詞中心必須對準音頭').toBeLessThanOrEqual(1);
    expect(metric.lyricTopDelta, '同一譜行歌詞 top 必須整齊').toBeLessThanOrEqual(lyricAlignmentMaximum);
    expect(metric.lyricBottomDelta, '同一譜行歌詞 bottom 必須整齊').toBeLessThanOrEqual(lyricAlignmentMaximum);
    if (metric.minimumLyricGap !== null) {
      expect(metric.minimumLyricGap, '英文歌詞不可互相重疊').toBeGreaterThanOrEqual(0);
    }
  }

  expect(maximumDelta(measurements.map((metric) => metric.lyricTopDelta))).toBeLessThanOrEqual(lyricAlignmentMaximum);
  expect(maximumAbsolute(measurements.map((metric) => metric.maximumLyricCenterError))).toBeLessThanOrEqual(1);
  expect(pageOverflow.scrollWidth).toBeLessThanOrEqual(pageOverflow.clientWidth + 1);
});
