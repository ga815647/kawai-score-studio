import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const reportDirectory = 'reports/visual';
const book = JSON.parse(await readFile('dist/scorebook.json', 'utf8'));
const visualMeasurements = book.gates.visual.measurements;
const lockedRows = book.layout.system_geometry.locked_standard_rows;

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function maximumDelta(values) {
  return values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
}

function requiredMagnitude(event, clearanceMinimum) {
  return Math.max(0, Math.ceil(clearanceMinimum - event.defaultGlyphClearancePx));
}

test('fixture renders two systems and minimally adjusts only labels that collide', async ({ page }) => {
  await mkdir(reportDirectory, { recursive: true });
  await page.goto('/?fixture=1', { waitUntil: 'networkidle' });
  await expect(page.locator('.status--pass')).toBeVisible();
  await expect(page.locator('#studio-view')).toBeVisible();
  await expect(page.locator('#score-title')).toHaveText('Synthetic Layout Fixture');
  await expect(page.locator('#score-page')).toHaveAttribute('data-synthetic', 'true');

  const systems = page.locator('.score-system');
  const systemCount = await systems.count();
  expect(systemCount).toBeGreaterThanOrEqual(visualMeasurements.minimum_system_count);

  const measurements = [];
  for (let systemIndex = 0; systemIndex < systemCount; systemIndex += 1) {
    const system = systems.nth(systemIndex);
    const metric = await system.evaluate((element) => {
      const rectanglesOverlap = (a, b) => (
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
      );
      const staff = element.querySelector('.staff-panel');
      const numberedRow = element.querySelector('.numbered-row');
      const lyricRow = element.querySelector('.lyric-row');
      const numbered = [...element.querySelectorAll('.numbered-note')];
      const lyrics = [...element.querySelectorAll('.score-lyric')];
      if (
        !(staff instanceof HTMLElement)
        || !(numberedRow instanceof HTMLElement)
        || !(lyricRow instanceof HTMLElement)
        || numbered.length === 0
        || lyrics.length === 0
      ) {
        throw new Error('system 缺少 staff、row、numbered notation 或 lyric');
      }

      const systemRect = element.getBoundingClientRect();
      const staffRect = staff.getBoundingClientRect();
      const numberedRowRect = numberedRow.getBoundingClientRect();
      const lyricRowRect = lyricRow.getBoundingClientRect();
      const topLine = staffRect.top + Number(element.dataset.staffTopLineY);
      const bottomLine = staffRect.top + Number(element.dataset.staffBottomLineY);
      const numberedRects = numbered.map((item) => item.getBoundingClientRect());
      const lyricRects = lyrics.map((item) => item.getBoundingClientRect());
      const numberBottom = Math.max(...numberedRects.map((rect) => rect.bottom));
      const lyricTop = Math.min(...lyricRects.map((rect) => rect.top));

      const numberedEvents = numbered.map((item, index) => ({
        label: 'numbered',
        eventId: item.dataset.eventId,
        pitch: item.dataset.pitch,
        boundingSource: item.dataset.boundingSource,
        standardGeometrySource: item.dataset.standardGeometrySource,
        verticalShiftPx: Number(item.dataset.verticalShiftPx),
        defaultGlyphClearancePx: Number(item.dataset.defaultGlyphClearancePx),
        adjustedGlyphClearancePx: Number(item.dataset.adjustedGlyphClearancePx),
        centerErrorPx: (numberedRects[index].left + numberedRects[index].right) / 2
          - (staffRect.left + Number(item.dataset.staffCenterX)),
        rect: {
          left: numberedRects[index].left,
          right: numberedRects[index].right,
          top: numberedRects[index].top,
          bottom: numberedRects[index].bottom,
        },
      }));
      const lyricEvents = lyrics.map((item, index) => ({
        label: 'lyric',
        eventId: item.dataset.lyricEventId,
        boundingSource: item.dataset.boundingSource,
        standardGeometrySource: item.dataset.standardGeometrySource,
        verticalShiftPx: Number(item.dataset.verticalShiftPx),
        defaultGlyphClearancePx: Number(item.dataset.defaultGlyphClearancePx),
        adjustedGlyphClearancePx: Number(item.dataset.adjustedGlyphClearancePx),
        centerErrorPx: (lyricRects[index].left + lyricRects[index].right) / 2
          - (staffRect.left + Number(item.dataset.staffCenterX)),
        rect: {
          left: lyricRects[index].left,
          right: lyricRects[index].right,
          top: lyricRects[index].top,
          bottom: lyricRects[index].bottom,
        },
      }));

      const defaultLyrics = lyricEvents.filter((event) => event.verticalShiftPx === 0);
      let lyricCollisionCount = 0;
      for (let leftIndex = 0; leftIndex < lyricEvents.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < lyricEvents.length; rightIndex += 1) {
          if (rectanglesOverlap(lyricEvents[leftIndex].rect, lyricEvents[rightIndex].rect)) {
            lyricCollisionCount += 1;
          }
        }
      }

      return {
        system: Number(element.dataset.system ?? 0),
        boundingSource: element.dataset.boundingSource,
        standardGeometrySource: element.dataset.standardGeometrySource,
        numberedCount: numbered.length,
        lyricCount: lyrics.length,
        defaultNumberedRowTop: numberedRowRect.top - systemRect.top,
        defaultLyricRowTop: lyricRowRect.top - systemRect.top,
        numberToStaffGap: topLine - numberBottom,
        staffToLyricGap: lyricTop - bottomLine,
        defaultLyricTopDelta: defaultLyrics.length > 0
          ? Math.max(...defaultLyrics.map((event) => event.rect.top)) - Math.min(...defaultLyrics.map((event) => event.rect.top))
          : 0,
        defaultLyricBottomDelta: defaultLyrics.length > 0
          ? Math.max(...defaultLyrics.map((event) => event.rect.bottom)) - Math.min(...defaultLyrics.map((event) => event.rect.bottom))
          : 0,
        lyricCollisionCount,
        numberedEvents,
        lyricEvents,
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
  await systems.nth(0).screenshot({
    path: `${reportDirectory}/synthetic-fixture-first-system.png`,
    animations: 'disabled',
    caret: 'hide',
  });
  await systems.nth(1).screenshot({
    path: `${reportDirectory}/synthetic-fixture-second-system.png`,
    animations: 'disabled',
    caret: 'hide',
  });

  const numberGapRange = visualMeasurements.numbered_to_staff_top_line_gap_px;
  const lyricGapRange = visualMeasurements.staff_bottom_line_to_lyric_top_px;
  const clearanceMinimum = visualMeasurements.adjusted_glyph_clearance_px.min;
  const defaultRowMaximum = visualMeasurements.default_row_delta_across_systems_px.max;
  const maximumShift = visualMeasurements.maximum_individual_shift_px.max;
  const numberedEvents = measurements.flatMap((metric) => metric.numberedEvents);
  const lyricEvents = measurements.flatMap((metric) => metric.lyricEvents);
  const allLabels = [...numberedEvents, ...lyricEvents];
  const highestNumber = numberedEvents.find((event) => event.pitch === book.instrument.highest_note);
  const lowestNumber = numberedEvents.find((event) => event.pitch === book.instrument.lowest_note);
  const extremeEventIds = [highestNumber?.eventId, lowestNumber?.eventId].filter(Boolean);
  const extremeLabels = Object.fromEntries(extremeEventIds.map((eventId) => [
    eventId,
    allLabels.filter((label) => label.eventId === eventId),
  ]));

  const defaultNumberedRowDelta = maximumDelta(measurements.map((metric) => metric.defaultNumberedRowTop));
  const defaultLyricRowDelta = maximumDelta(measurements.map((metric) => metric.defaultLyricRowTop));
  const lockedNumberedRowsPass = measurements.every((metric) => (
    Math.abs(metric.defaultNumberedRowTop - lockedRows.numbered_row_top_px) <= defaultRowMaximum
  ));
  const lockedLyricRowsPass = measurements.every((metric) => (
    Math.abs(metric.defaultLyricRowTop - lockedRows.lyric_row_top_px) <= defaultRowMaximum
  ));
  const allBoundingSourcesPass = measurements.every((metric) => (
    metric.boundingSource === 'vexflow-stavenote-pointer-rect'
  )) && allLabels.every((label) => label.boundingSource === 'vexflow-stavenote-pointer-rect');
  const allStandardGeometrySourcesPass = measurements.every((metric) => (
    metric.standardGeometrySource === 'scorebook-system-geometry'
  )) && allLabels.every((label) => label.standardGeometrySource === 'scorebook-system-geometry');
  const allClearancesPass = allLabels.every((label) => (
    label.adjustedGlyphClearancePx >= clearanceMinimum
  ));
  const directionsPass = numberedEvents.every((label) => label.verticalShiftPx <= 0)
    && lyricEvents.every((label) => label.verticalShiftPx >= 0);
  const shiftsAreMinimal = allLabels.every((label) => (
    Math.abs(label.verticalShiftPx) === requiredMagnitude(label, clearanceMinimum)
  ));
  const uncollidedLabelsStayStandard = allLabels.every((label) => (
    label.defaultGlyphClearancePx < clearanceMinimum || label.verticalShiftPx === 0
  ));
  const shiftedLabelsNeededAdjustment = allLabels.every((label) => (
    label.verticalShiftPx === 0 || label.defaultGlyphClearancePx < clearanceMinimum
  ));
  const extremeEventsFollowSameRule = extremeEventIds.length === 2
    && extremeEventIds.every((eventId) => extremeLabels[eventId].every((label) => (
      label.adjustedGlyphClearancePx >= clearanceMinimum
      && Math.abs(label.verticalShiftPx) === requiredMagnitude(label, clearanceMinimum)
    )));
  const safeExtremeLabelsStayStandard = extremeEventIds.every((eventId) => (
    extremeLabels[eventId].every((label) => (
      label.defaultGlyphClearancePx < clearanceMinimum || label.verticalShiftPx === 0
    ))
  ));
  const ordinaryStandardLabelCount = allLabels.filter((label) => (
    !extremeEventIds.includes(label.eventId) && label.verticalShiftPx === 0
  )).length;

  const pass = measurements.every((metric) => (
    metric.numberToStaffGap >= numberGapRange.min
    && metric.numberToStaffGap <= numberGapRange.max
    && metric.staffToLyricGap >= lyricGapRange.min
    && metric.staffToLyricGap <= lyricGapRange.max
    && metric.defaultLyricTopDelta <= defaultRowMaximum
    && metric.defaultLyricBottomDelta <= defaultRowMaximum
    && metric.lyricCollisionCount === 0
    && metric.numberedEvents.every((event) => Math.abs(event.centerErrorPx) <= 1)
    && metric.lyricEvents.every((event) => Math.abs(event.centerErrorPx) <= 1)
  ))
    && systemCount >= visualMeasurements.minimum_system_count
    && defaultNumberedRowDelta <= defaultRowMaximum
    && defaultLyricRowDelta <= defaultRowMaximum
    && lockedNumberedRowsPass
    && lockedLyricRowsPass
    && highestNumber !== undefined
    && lowestNumber !== undefined
    && allBoundingSourcesPass
    && allStandardGeometrySourcesPass
    && allClearancesPass
    && directionsPass
    && shiftsAreMinimal
    && uncollidedLabelsStayStandard
    && shiftedLabelsNeededAdjustment
    && extremeEventsFollowSameRule
    && safeExtremeLabelsStayStandard
    && ordinaryStandardLabelCount > 0
    && allLabels.every((label) => Math.abs(label.verticalShiftPx) <= maximumShift)
    && pageOverflow.scrollWidth <= pageOverflow.clientWidth + 1;

  const report = {
    pass,
    headSha: process.env.GITHUB_SHA ?? null,
    fixture: 'layout-rhythm-language',
    systemCount,
    boundingSource: 'vexflow-stavenote-pointer-rect',
    standardGeometrySource: 'scorebook-system-geometry',
    lockedStandardRows: lockedRows,
    instrumentExtremes: {
      lowestNote: book.instrument.lowest_note,
      highestNote: book.instrument.highest_note,
    },
    configuredMeasurements: visualMeasurements,
    defaultRowDeltas: {
      numberedRow: round(defaultNumberedRowDelta),
      lyricRow: round(defaultLyricRowDelta),
    },
    lockedRowsPass: {
      numberedRow: lockedNumberedRowsPass,
      lyricRow: lockedLyricRowsPass,
    },
    extremeAdjustments: Object.fromEntries(Object.entries(extremeLabels).map(([eventId, labels]) => [
      eventId,
      labels.map((label) => ({
        label: label.label,
        verticalShiftPx: label.verticalShiftPx,
        defaultGlyphClearancePx: round(label.defaultGlyphClearancePx),
        adjustedGlyphClearancePx: round(label.adjustedGlyphClearancePx),
      })),
    ])),
    ordinaryStandardLabelCount,
    screenshots: [
      'synthetic-fixture-a4.png',
      'synthetic-fixture-first-system.png',
      'synthetic-fixture-second-system.png',
    ],
    measurements: measurements.map((metric) => ({
      ...metric,
      defaultNumberedRowTop: round(metric.defaultNumberedRowTop),
      defaultLyricRowTop: round(metric.defaultLyricRowTop),
      numberToStaffGap: round(metric.numberToStaffGap),
      staffToLyricGap: round(metric.staffToLyricGap),
      defaultLyricTopDelta: round(metric.defaultLyricTopDelta),
      defaultLyricBottomDelta: round(metric.defaultLyricBottomDelta),
      numberedEvents: metric.numberedEvents.map((event) => ({
        ...event,
        defaultGlyphClearancePx: round(event.defaultGlyphClearancePx),
        adjustedGlyphClearancePx: round(event.adjustedGlyphClearancePx),
        centerErrorPx: round(event.centerErrorPx),
      })),
      lyricEvents: metric.lyricEvents.map((event) => ({
        ...event,
        defaultGlyphClearancePx: round(event.defaultGlyphClearancePx),
        adjustedGlyphClearancePx: round(event.adjustedGlyphClearancePx),
        centerErrorPx: round(event.centerErrorPx),
      })),
    })),
  };
  await writeFile(`${reportDirectory}/visual-gate-report.json`, `${JSON.stringify(report, null, 2)}\n`);

  expect(systemCount, 'fixture 至少要有兩個譜行').toBeGreaterThanOrEqual(2);
  expect(defaultNumberedRowDelta, '全曲預設簡譜列必須一致').toBeLessThanOrEqual(defaultRowMaximum);
  expect(defaultLyricRowDelta, '全曲預設歌詞列必須一致').toBeLessThanOrEqual(defaultRowMaximum);
  expect(lockedNumberedRowsPass, '五線譜上移時不得移動預設簡譜列').toBe(true);
  expect(lockedLyricRowsPass, '五線譜上移時不得移動預設歌詞列').toBe(true);
  expect(highestNumber, `fixture 必須包含最高音 ${book.instrument.highest_note}`).toBeDefined();
  expect(lowestNumber, `fixture 必須包含最低音 ${book.instrument.lowest_note}`).toBeDefined();
  expect(allBoundingSourcesPass, '碰撞必須使用每顆 StaveNote 的 pointer rectangle').toBe(true);
  expect(allStandardGeometrySourcesPass, '全曲標準位置必須來自 scorebook 幾何').toBe(true);
  expect(allClearancesPass, '位移後仍須保留音符外框安全距離').toBe(true);
  expect(directionsPass, '簡譜只能上移，歌詞只能下移').toBe(true);
  expect(shiftsAreMinimal, '每個標籤只能做解除碰撞所需的最小位移').toBe(true);
  expect(uncollidedLabelsStayStandard, '未碰撞標籤不可任意位移').toBe(true);
  expect(shiftedLabelsNeededAdjustment, '位移必須由該標籤的實際碰撞觸發').toBe(true);
  expect(extremeEventsFollowSameRule, '最高音與最低音必須套用與一般音相同的碰撞規則').toBe(true);
  expect(safeExtremeLabelsStayStandard, '極端音已有足夠距離時不可強迫位移').toBe(true);
  expect(ordinaryStandardLabelCount, '至少要有一般音域標籤維持全曲標準位置').toBeGreaterThan(0);

  for (const metric of measurements) {
    expect(metric.defaultNumberedRowTop, '預設簡譜列位置不得改變').toBeCloseTo(lockedRows.numbered_row_top_px, 3);
    expect(metric.defaultLyricRowTop, '預設歌詞列位置不得改變').toBeCloseTo(lockedRows.lyric_row_top_px, 3);
    expect(metric.numberToStaffGap, '標準簡譜列與五線譜距離太近').toBeGreaterThanOrEqual(numberGapRange.min);
    expect(metric.numberToStaffGap, '標準簡譜列與五線譜距離太遠').toBeLessThanOrEqual(numberGapRange.max);
    expect(metric.staffToLyricGap, '標準歌詞列與五線譜距離太近').toBeGreaterThanOrEqual(lyricGapRange.min);
    expect(metric.staffToLyricGap, '標準歌詞列與五線譜距離太遠').toBeLessThanOrEqual(lyricGapRange.max);
    expect(metric.defaultLyricTopDelta, '未位移歌詞 top 必須整齊').toBeLessThanOrEqual(defaultRowMaximum);
    expect(metric.defaultLyricBottomDelta, '未位移歌詞 bottom 必須整齊').toBeLessThanOrEqual(defaultRowMaximum);
    expect(metric.lyricCollisionCount, '英文歌詞不可實際互撞').toBe(0);
  }
  expect(pageOverflow.scrollWidth).toBeLessThanOrEqual(pageOverflow.clientWidth + 1);
});
