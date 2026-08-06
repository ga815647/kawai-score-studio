import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const reportDirectory = 'reports/visual';
const minimumLyricGapPx = 8;
const maximumHorizontalShiftPx = 24;

const songs = [
  { id: 'twinkle-twinkle-little-star-zh', title: '小星星', notes: 42, lyrics: 42 },
  { id: 'two-tigers-zh', title: '兩隻老虎', notes: 32, lyrics: 32 },
  { id: 'old-macdonald-zh', title: '王老先生有塊地', notes: 58, lyrics: 58 },
  { id: 'mary-had-a-little-lamb-zh', title: '瑪麗有隻小綿羊', notes: 25, lyrics: 25 },
  { id: 'happy-birthday-zh', title: '生日快樂', notes: 25, lyrics: 24 },
];

test('all five Traditional Chinese nursery songs render without lyric collisions or overflow', async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(reportDirectory, { recursive: true });
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('.status--pass')).toBeVisible();
  await expect(page.locator('#library-view')).toBeVisible();
  await expect(page.locator('main > .error-card')).toHaveCount(0);

  const reports = [];
  for (const song of songs) {
    const card = page.locator(`.library-song[data-score-id="${song.id}"]`);
    await expect(card).toBeVisible();
    await expect(card.locator('h3')).toContainText(song.title);
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

    const screenshot = `${song.id}-library.png`;
    await card.screenshot({
      path: `${reportDirectory}/${screenshot}`,
      animations: 'disabled',
      caret: 'hide',
    });

    reports.push({
      ...song,
      systemCount,
      lyricSpacing,
      overflow,
      screenshot,
    });
  }

  await page.emulateMedia({ media: 'print' });
  for (const song of songs) {
    const card = page.locator(`.library-song[data-score-id="${song.id}"]`);
    const printGeometry = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        breakInside: style.breakInside,
        pageBreakInside: style.pageBreakInside,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(printGeometry.scrollWidth).toBeLessThanOrEqual(printGeometry.clientWidth + 1);
    expect(['avoid', 'auto']).toContain(printGeometry.breakInside);
  }

  await writeFile(
    `${reportDirectory}/chinese-nursery-five-library-report.json`,
    `${JSON.stringify({
      pass: true,
      headSha: process.env.GITHUB_SHA ?? null,
      minimumLyricGapPx,
      maximumHorizontalShiftPx,
      songs: reports,
    }, null, 2)}\n`,
  );
});
