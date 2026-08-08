import { mkdir, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const reportDirectory = 'reports/visual';
const continuationPdf = `${reportDirectory}/continuation-page-top-clearance.pdf`;
const minimumVisibleTopMarginMm = 10;

test('continuation print pages keep the whole score safely below the physical page top', async ({ page }) => {
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

  await target.evaluate((element) => {
    const render = element.querySelector('.score-render');
    const sourceSystem = render?.querySelector('.score-system');
    if (!render || !sourceSystem) throw new Error('Regression fixture needs a rendered score system');

    // Force a true multi-page print case while exercising the renderer's allowed
    // maximum upward numbered-notation adjustment on every continuation system.
    for (let index = 0; index < 10; index += 1) {
      const clone = sourceSystem.cloneNode(true);
      clone.dataset.system = `print-regression-${index + 1}`;
      for (const note of clone.querySelectorAll('.numbered-note')) note.style.top = '-32px';
      render.append(clone);
    }
  });

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

  const secondPage = await document.getPage(2);
  const viewport = secondPage.getViewport({ scale: 1 });
  const textContent = await secondPage.getTextContent();
  const visibleItems = textContent.items.filter((item) => item.str?.trim());
  expect(visibleItems.length).toBeGreaterThan(0);

  const topMostTextPt = Math.max(...visibleItems.map((item) => (
    Number(item.transform?.[5] ?? 0) + Number(item.height ?? 0)
  )));
  const topMarginPt = viewport.height - topMostTextPt;
  const topMarginMm = topMarginPt * 25.4 / 72;

  expect(topMarginMm).toBeGreaterThanOrEqual(minimumVisibleTopMarginMm);
});
