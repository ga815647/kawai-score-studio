import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const reportDirectory = 'reports/visual';
const minimumLyricGapPx = 8;
const maximumHorizontalShiftPx = 24;

test('verified Hickory Dickory Dock renders in the formal library', async ({ page }) => {
  await mkdir(reportDirectory, { recursive: true });
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('.status--pass')).toBeVisible();
  await expect(page.locator('#library-view')).toBeVisible();
  await expect(page.locator('#error-template')).toHaveCount(1);
  await expect(page.locator('main > .error-card')).toHaveCount(0);

  const card = page.locator('.library-song[data-score-id="hickory-dickory-dock"]');
  await expect(card).toBeVisible();
  await expect(card.locator('h3')).toHaveText('Hickory Dickory Dock（老鼠時鐘）');
  await expect(card.locator('p')).toHaveText('6/8 · C major · verified');

  const systems = card.locator('.score-system');
  const systemCount = await systems.count();
  expect(systemCount).toBe(4);
  await expect(card.locator('.numbered-note')).toHaveCount(30);
  await expect(card.locator('.score-lyric')).toHaveCount(28);

  const lyricSpacing = await systems.evaluateAll((elements, minimumGap) => elements.map((system) => {
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
    const systemRect = system.getBoundingClientRect();
    const gaps = lyrics.slice(1).map((lyric, index) => ({
      leftEvent: lyrics[index].eventId,
      rightEvent: lyric.eventId,
      gapPx: lyric.left - lyrics[index].right,
    }));
    return {
      system: Number(system.dataset.system),
      gaps,
      minimumGapPx: gaps.length > 0 ? Math.min(...gaps.map((gap) => gap.gapPx)) : null,
      maximumHorizontalShiftPx: Number(system.dataset.maximumHorizontalShift ?? 0),
      centerErrorsPx: lyrics.map((lyric) => ({
        eventId: lyric.eventId,
        errorPx: lyric.center - systemRect.left - lyric.staffCenterX,
      })),
      lyricShifts: lyrics.map((lyric) => ({
        eventId: lyric.eventId,
        horizontalShiftPx: lyric.horizontalShiftPx,
      })),
      pass: gaps.every((gap) => gap.gapPx >= minimumGap - 0.01),
    };
  }), minimumLyricGapPx);
  expect(lyricSpacing.every((system) => system.pass)).toBe(true);
  expect(lyricSpacing.every((system) => system.maximumHorizontalShiftPx <= maximumHorizontalShiftPx + 0.01)).toBe(true);
  expect(lyricSpacing.flatMap((system) => system.centerErrorsPx).every((entry) => Math.abs(entry.errorPx) <= 0.01)).toBe(true);

  const explicitTieCount = await systems.evaluateAll((elements) => elements.reduce(
    (total, system) => total + Number(system.dataset.explicitTieCount ?? 0),
    0,
  ));
  expect(explicitTieCount).toBe(2);

  const overflow = await card.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  const screenshot = 'hickory-dickory-dock-library.png';
  await card.screenshot({
    path: `${reportDirectory}/${screenshot}`,
    animations: 'disabled',
    caret: 'hide',
  });

  const report = {
    pass: true,
    headSha: process.env.GITHUB_SHA ?? null,
    scoreId: 'hickory-dickory-dock',
    systemCount,
    numberedNoteCount: 30,
    lyricCount: 28,
    explicitTieCount,
    minimumLyricGapPx,
    maximumHorizontalShiftPx,
    lyricSpacing,
    overflow,
    screenshot,
  };
  await writeFile(
    `${reportDirectory}/hickory-dickory-dock-library-report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
});
