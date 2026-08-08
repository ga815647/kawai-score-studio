import { mkdir, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const reportDirectory = 'reports/visual';
const continuationPdf = `${reportDirectory}/continuation-page-top-clearance.pdf`;
const minimumVisibleTopMarginMm = 10;
const regressionSystemCount = 10;

test('continuation print pages start safely below the top and never split a score system', async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(reportDirectory, { recursive: true });
  await page.addInitScript(() => {
    window.print = () => { window.__printCalled = true; };
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.status--pass')).toBeVisible();

  const target = page.locator('.library-song[data-score-id="hickory-dickory-dock"]');
  await target.locator('button[data-action="print"]').click();
  await expect.poll(() => page.evaluate(() => window.__printCalled === true)).toBe(true);
  await expect(target).toHaveClass(/print-selected/);

  await target.evaluate((element, systemCount) => {
    const render = element.querySelector('.score-render');
    const sourceSystem = render?.querySelector('.score-system');
    if (!render || !sourceSystem) throw new Error('Regression fixture needs a rendered score system');

    // Force a true multi-page print case while exercising the renderer's allowed
    // maximum upward numbered-notation adjustment on every continuation system.
    // A unique top-number / lyric marker pair lets the PDF gate prove that the
    // numbered row and the lower part of each system stay on the same page.
    for (let index = 0; index < systemCount; index += 1) {
      const clone = sourceSystem.cloneNode(true);
      const marker = String(index + 1).padStart(2, '0');
      clone.dataset.system = `print-regression-${marker}`;
      for (const note of clone.querySelectorAll('.numbered-note')) note.style.top = '-32px';

      const topMarker = clone.querySelector('.note-number');
      const lowerMarker = clone.querySelector('.score-lyric');
      if (!topMarker || !lowerMarker) throw new Error('Regression system needs note and lyric markers');
      topMarker.textContent = `T${marker}`;
      topMarker.style.fontSize = '6px';
      lowerMarker.textContent = `L${marker}`;
      lowerMarker.style.fontSize = '6px';
      render.append(clone);
    }
  }, regressionSystemCount);

  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: continuationPdf,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });

  const document = await getDocument({
    data: new Uint8Array(await readFile(continuationPdf)),
    disableWorker: true,
  }).promise;
  expect(document.numPages).toBeGreaterThanOrEqual(2);

  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const pdfPage = await document.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const textContent = await pdfPage.getTextContent();
    pages.push({ pageNumber, viewport, items: textContent.items });
  }

  const secondPage = pages[1];
  const visibleItems = secondPage.items.filter((item) => {
    const text = item.str?.trim();
    return text && !/^[TL]\d{2}$/.test(text);
  });
  expect(visibleItems.length).toBeGreaterThan(0);

  const topMostTextPt = Math.max(...visibleItems.map((item) => (
    Number(item.transform?.[5] ?? 0) + Number(item.height ?? 0)
  )));
  const topMarginPt = secondPage.viewport.height - topMostTextPt;
  const topMarginMm = topMarginPt * 25.4 / 72;
  expect(topMarginMm).toBeGreaterThanOrEqual(minimumVisibleTopMarginMm);

  const pageForMarker = (marker) => pages.find(({ items }) => (
    items.some((item) => item.str?.trim() === marker)
  ))?.pageNumber ?? null;

  for (let index = 0; index < regressionSystemCount; index += 1) {
    const marker = String(index + 1).padStart(2, '0');
    const topPage = pageForMarker(`T${marker}`);
    const lowerPage = pageForMarker(`L${marker}`);
    expect(topPage, `missing top marker T${marker}`).not.toBeNull();
    expect(lowerPage, `missing lower marker L${marker}`).not.toBeNull();
    expect(lowerPage, `score system ${marker} was fragmented across pages`).toBe(topPage);
  }
});
