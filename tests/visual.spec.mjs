import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const book = JSON.parse(await readFile('dist/scorebook.json', 'utf8'));
const visualGate = book.gates.visual;
const numberedNotation = book.layout.notation_system.numbered_notation;
const artifactDirectory = visualGate.artifacts.directory;

function round(value) {
  return Math.round(value * 1000) / 1000;
}

test('browser visual gate captures A4 screenshots and enforces compact spacing', async ({ page }) => {
  await mkdir(artifactDirectory, { recursive: true });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator(visualGate.runner.wait_for_selector)).toBeVisible();

  const song = page.locator(`.song-page[data-song-id="${visualGate.runner.target_song_id}"]`);
  await expect(song).toBeVisible();
  await expect(song.locator('.phrase-system')).not.toHaveCount(0);

  const pageScale = await song.evaluate((article) => Number(article.parentElement?.dataset.scale ?? '1'));
  expect(pageScale).toBeGreaterThan(0);

  const metrics = await song.evaluate((article, gateConfig) => {
    const scale = Number(article.parentElement?.dataset.scale ?? '1');
    const systems = [...article.querySelectorAll('.phrase-system')];
    return systems.map((system, index) => {
      const staff = system.querySelector('.staff-panel');
      const lyrics = [...system.querySelectorAll('.lyric')];
      if (!(staff instanceof HTMLElement) || lyrics.length === 0) {
        throw new Error(`第 ${index + 1} 譜行缺少 staff 或 lyric`);
      }

      const staffRect = staff.getBoundingClientRect();
      const topLineY = Number(staff.dataset.staffTopLineY);
      if (!Number.isFinite(topLineY)) {
        throw new Error(`第 ${index + 1} 譜行缺少 VexFlow top-line 幾何資料`);
      }

      const lyricRects = lyrics.map((lyric) => lyric.getBoundingClientRect());
      const lyricBottom = Math.max(...lyricRects.map((rect) => rect.bottom));
      const staffTopLine = staffRect.top + topLineY * scale;
      const gap = staffTopLine - lyricBottom;

      return {
        system: index + 1,
        eventCount: system.querySelectorAll('.event').length,
        scale,
        lyricBottom,
        staffTopLine,
        gap,
        minimum: gateConfig.measurements.lyric_to_staff_top_line_gap_px.min,
        maximum: gateConfig.measurements.lyric_to_staff_top_line_gap_px.max,
      };
    });
  }, visualGate);

  for (const screenshot of visualGate.screenshots) {
    const target = page.locator(screenshot.selector);
    await expect(target).toBeVisible();
    await target.screenshot({
      path: join(artifactDirectory, screenshot.filename),
      animations: 'disabled',
      caret: 'hide',
    });
  }

  const pass = metrics.length > 0 && metrics.every((metric) => (
    metric.gap >= metric.minimum && metric.gap <= metric.maximum
  ));
  const report = {
    pass,
    scorebookVersion: book.project.version,
    headSha: process.env.GITHUB_SHA ?? null,
    browser: visualGate.runner.browser,
    playwrightVersion: visualGate.runner.version,
    viewport: visualGate.runner.viewport,
    targetSongId: visualGate.runner.target_song_id,
    configuredSpacing: numberedNotation,
    measurements: metrics.map((metric) => ({
      ...metric,
      lyricBottom: round(metric.lyricBottom),
      staffTopLine: round(metric.staffTopLine),
      gap: round(metric.gap),
    })),
    screenshots: visualGate.screenshots.map((item) => item.filename),
  };
  await writeFile(
    join(artifactDirectory, 'visual-gate-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  expect(metrics.length).toBeGreaterThan(0);
  for (const metric of metrics) {
    expect(
      metric.gap,
      `第 ${metric.system} 譜行中文到五線譜第一線距離 ${round(metric.gap)}px 小於規格`,
    ).toBeGreaterThanOrEqual(metric.minimum);
    expect(
      metric.gap,
      `第 ${metric.system} 譜行中文到五線譜第一線距離 ${round(metric.gap)}px 大於規格`,
    ).toBeLessThanOrEqual(metric.maximum);
  }
});
