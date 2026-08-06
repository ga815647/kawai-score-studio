import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const reportDirectory = 'reports/visual';

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
  expect(systemCount).toBeGreaterThanOrEqual(2);
  await expect(card.locator('.numbered-note')).toHaveCount(30);
  await expect(card.locator('.score-lyric')).toHaveCount(28);

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
    overflow,
    screenshot,
  };
  await writeFile(
    `${reportDirectory}/hickory-dickory-dock-library-report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
});
