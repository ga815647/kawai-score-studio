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

function maxAbsolute(values) {
  return Math.max(0, ...values.map((value) => Math.abs(value)));
}

test('browser visual gate captures A4 screenshots and validates typography geometry', async ({ page }) => {
  await mkdir(artifactDirectory, { recursive: true });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator(visualGate.runner.wait_for_selector)).toBeVisible();

  const song = page.locator(`.song-page[data-song-id="${visualGate.runner.target_song_id}"]`);
  await expect(song).toBeVisible();
  await expect(song.locator('.phrase-system')).not.toHaveCount(0);
  await expect(song.locator('.note-box')).toHaveCount(0);

  const pageScale = await song.evaluate((article) => Number(article.parentElement?.dataset.scale ?? '1'));
  expect(pageScale).toBeGreaterThan(0);

  const metrics = await song.evaluate((article, gateConfig) => {
    const scale = Number(article.parentElement?.dataset.scale ?? '1');
    const systems = [...article.querySelectorAll('.phrase-system')];
    return systems.map((system, index) => {
      const row = system.querySelector('.note-row');
      const staff = system.querySelector('.staff-panel');
      const events = [...system.querySelectorAll('.event')];
      const numbers = [...system.querySelectorAll('.numbered-note')];
      const noteNumbers = [...system.querySelectorAll('.note-number')];
      const lyrics = [...system.querySelectorAll('.lyric')];
      if (
        !(row instanceof HTMLElement)
        || !(staff instanceof HTMLElement)
        || events.length === 0
        || numbers.length !== events.length
        || noteNumbers.length !== events.length
        || lyrics.length !== events.length
      ) {
        throw new Error(`第 ${index + 1} 譜行缺少 row、staff、number 或 lyric`);
      }

      const rowRect = row.getBoundingClientRect();
      const staffRect = staff.getBoundingClientRect();
      const topLineY = Number(staff.dataset.staffTopLineY);
      if (!Number.isFinite(topLineY)) {
        throw new Error(`第 ${index + 1} 譜行缺少 VexFlow top-line 幾何資料`);
      }

      const expectedCenters = events.map((event) => {
        const anchor = Number(event.dataset.staffAnchorX);
        if (!Number.isFinite(anchor)) throw new Error('event 缺少 staff anchor');
        return rowRect.left + anchor * scale;
      });
      const numberRects = numbers.map((number) => number.getBoundingClientRect());
      const lyricRects = lyrics.map((lyric) => lyric.getBoundingClientRect());
      const numberCenterErrors = numberRects.map((rect, eventIndex) => (
        (rect.left + rect.right) / 2 - expectedCenters[eventIndex]
      ));
      const lyricCenterErrors = lyricRects.map((rect, eventIndex) => (
        (rect.left + rect.right) / 2 - expectedCenters[eventIndex]
      ));

      const lyricBottom = Math.max(...lyricRects.map((rect) => rect.bottom));
      const staffTopLine = staffRect.top + topLineY * scale;
      const gap = staffTopLine - lyricBottom;
      const numberStyle = getComputedStyle(numbers[0]);
      const noteNumberStyle = getComputedStyle(noteNumbers[0]);
      const lyricStyle = getComputedStyle(lyrics[0]);

      return {
        system: index + 1,
        eventCount: events.length,
        scale,
        lyricBottom,
        staffTopLine,
        gap,
        gapMinimum: gateConfig.measurements.lyric_to_staff_top_line_gap_px.min,
        gapMaximum: gateConfig.measurements.lyric_to_staff_top_line_gap_px.max,
        lyricFontSize: Number.parseFloat(lyricStyle.fontSize),
        expectedLyricFontSize: gateConfig.measurements.lyric_font_size_px,
        noteNumberFontSize: Number.parseFloat(noteNumberStyle.fontSize),
        expectedNoteNumberFontSize: gateConfig.measurements.note_number_font_size_px,
        numberCenterErrors,
        lyricCenterErrors,
        centerErrorMaximum: gateConfig.measurements.number_center_to_notehead_center_error_px.max,
        noteBoxCount: system.querySelectorAll('.note-box').length,
        numberBorderWidths: [
          numberStyle.borderTopWidth,
          numberStyle.borderRightWidth,
          numberStyle.borderBottomWidth,
          numberStyle.borderLeftWidth,
        ],
        numberBackgroundColor: numberStyle.backgroundColor,
        numberBoxShadow: numberStyle.boxShadow,
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
    metric.gap >= metric.gapMinimum
    && metric.gap <= metric.gapMaximum
    && metric.lyricFontSize === metric.expectedLyricFontSize
    && metric.noteNumberFontSize === metric.expectedNoteNumberFontSize
    && maxAbsolute(metric.numberCenterErrors) <= metric.centerErrorMaximum
    && maxAbsolute(metric.lyricCenterErrors) <= metric.centerErrorMaximum
    && metric.noteBoxCount === 0
    && metric.numberBorderWidths.every((width) => width === '0px')
    && metric.numberBackgroundColor === 'rgba(0, 0, 0, 0)'
    && metric.numberBoxShadow === 'none'
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
    configuredTypography: book.notation.typography,
    measurements: metrics.map((metric) => ({
      ...metric,
      lyricBottom: round(metric.lyricBottom),
      staffTopLine: round(metric.staffTopLine),
      gap: round(metric.gap),
      lyricFontSize: round(metric.lyricFontSize),
      noteNumberFontSize: round(metric.noteNumberFontSize),
      numberCenterErrors: metric.numberCenterErrors.map(round),
      lyricCenterErrors: metric.lyricCenterErrors.map(round),
      maximumNumberCenterError: round(maxAbsolute(metric.numberCenterErrors)),
      maximumLyricCenterError: round(maxAbsolute(metric.lyricCenterErrors)),
    })),
    screenshots: visualGate.screenshots.map((item) => item.filename),
  };
  await writeFile(
    join(artifactDirectory, 'visual-gate-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  expect(metrics.length).toBeGreaterThan(0);
  for (const metric of metrics) {
    expect(metric.noteBoxCount, `第 ${metric.system} 譜行仍存在音符框`).toBe(0);
    expect(metric.numberBorderWidths.every((width) => width === '0px')).toBe(true);
    expect(metric.numberBackgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(metric.numberBoxShadow).toBe('none');
    expect(
      metric.lyricFontSize,
      `第 ${metric.system} 譜行中文字級不符合規格`,
    ).toBe(metric.expectedLyricFontSize);
    expect(
      metric.noteNumberFontSize,
      `第 ${metric.system} 譜行簡譜字級不符合規格`,
    ).toBe(metric.expectedNoteNumberFontSize);
    expect(
      metric.gap,
      `第 ${metric.system} 譜行中文到五線譜第一線距離 ${round(metric.gap)}px 小於規格`,
    ).toBeGreaterThanOrEqual(metric.gapMinimum);
    expect(
      metric.gap,
      `第 ${metric.system} 譜行中文到五線譜第一線距離 ${round(metric.gap)}px 大於規格`,
    ).toBeLessThanOrEqual(metric.gapMaximum);
    expect(
      maxAbsolute(metric.numberCenterErrors),
      `第 ${metric.system} 譜行彩色數字中心誤差過大`,
    ).toBeLessThanOrEqual(metric.centerErrorMaximum);
    expect(
      maxAbsolute(metric.lyricCenterErrors),
      `第 ${metric.system} 譜行中文中心誤差過大`,
    ).toBeLessThanOrEqual(metric.centerErrorMaximum);
  }
});
