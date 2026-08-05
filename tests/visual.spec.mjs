import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const reportDirectory = 'reports/visual';

function round(value) {
  return Math.round(value * 1000) / 1000;
}

test('fixture renders numbered notation above staff and English lyrics below', async ({ page }) => {
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
      const expectedCenters = numbered.map((item) => staffRect.left + Number(item.dataset.staffCenterX));
      const numberCenterErrors = numberedRects.map((rect, index) => (
        (rect.left + rect.right) / 2 - expectedCenters[index]
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
        minimumLyricGap: lyricGaps.length > 0 ? Math.min(...lyricGaps) : null,
      };
    });
    measurements.push(metric);

    expect(metric.numberToStaffGap, '簡譜不可碰到五線譜').toBeGreaterThanOrEqual(8);
    expect(metric.staffToLyricGap, '歌詞必須位於五線譜下方').toBeGreaterThanOrEqual(2);
    expect(metric.maximumNumberCenterError, '簡譜中心必須對準音頭').toBeLessThanOrEqual(1);
    if (metric.minimumLyricGap !== null) {
      expect(metric.minimumLyricGap, '英文歌詞不可互相重疊').toBeGreaterThanOrEqual(0);
    }
  }

  const pageOverflow = await page.locator('#score-page').evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(pageOverflow.scrollWidth).toBeLessThanOrEqual(pageOverflow.clientWidth + 1);

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

  const report = {
    pass: true,
    headSha: process.env.GITHUB_SHA ?? null,
    fixture: 'layout-rhythm-language',
    screenshots: [
      'synthetic-fixture-a4.png',
      'synthetic-fixture-first-system.png',
    ],
    measurements: measurements.map((metric) => Object.fromEntries(
      Object.entries(metric).map(([key, value]) => [key, typeof value === 'number' ? round(value) : value]),
    )),
  };
  await writeFile(`${reportDirectory}/visual-gate-report.json`, `${JSON.stringify(report, null, 2)}\n`);
});
