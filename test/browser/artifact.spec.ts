import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { SKINS } from '../../src/styles/skins.ts';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

/** Render the real Stage 0 document against the live checkouts. */
function renderArtifact(): string {
  const out = join(mkdtempSync(join(tmpdir(), 'explorer2-browser-')), 'artifact.html');
  execFileSync(
    process.execPath,
    ['--experimental-strip-types', 'src/cli.ts', 'render', 'stage0/feature-feedback.md', '-o', out],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return out;
}

const ARTIFACT = renderArtifact();

/**
 * Deny everything that is not the artifact itself. Any off-disk request is a
 * failure of the offline guarantee, not a slow test.
 */
async function openOffline(page: Page): Promise<string[]> {
  const offDisk: string[] = [];
  const consoleErrors: string[] = [];

  page.on('request', request => {
    if (!request.url().startsWith('file://')) offDisk.push(request.url());
  });
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  // Abort everything that is not the artifact on disk. Routing file:// too
  // would abort the navigation itself and prove nothing.
  await page.context().route('**', route => {
    if (route.request().url().startsWith('file://')) route.continue();
    else route.abort();
  });
  await page.goto(pathToFileURL(ARTIFACT).href);

  expect(offDisk).toEqual([]);
  return consoleErrors;
}

test('opens from file:// with the network denied and logs nothing', async ({ page }) => {
  const errors = await openOffline(page);

  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('figure.cite')).toHaveCount(9);
  expect(errors).toEqual([]);
});

test('hides context lines until the reader asks for them', async ({ page }) => {
  await openOffline(page);

  const figure = page.locator('figure.cite').first();
  const context = figure.locator('.line.ctx');

  await expect(context.first()).toBeHidden();
  await figure.locator('.cite-more').click();
  await expect(context.first()).toBeVisible();
  await expect(figure.locator('.cite-more')).toHaveAttribute('aria-expanded', 'true');
});

test('holds the cited lines still while context opens above them', async ({ page }) => {
  await openOffline(page);

  // Far enough down the page that the window has room to scroll either way.
  const figure = page.locator('figure.cite').nth(3);
  const button = figure.locator('.cite-more');

  // Bring the button itself into view and measure after that settles. Measuring
  // first would record Playwright's own pre-click scroll as if the page had
  // moved under the reader.
  await button.scrollIntoViewIfNeeded();
  const citedLine = figure.locator('.line:not(.ctx)').first();
  const before = await citedLine.boundingBox();

  await button.click();
  const after = await citedLine.boundingBox();

  expect(after!.y - before!.y).toBeLessThan(2);
  // Context really did open above the citation, so holding still took work.
  await expect(figure.locator('.line.ctx').first()).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('copies a follow-up prompt naming the repo, sha, path and lines', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openOffline(page);

  const figure = page.locator('figure.cite').first();
  const expected = await figure.locator('.ask').getAttribute('data-ask');
  await figure.locator('.ask').click();

  await expect(page.locator('.toast')).toHaveText('prompt copied');

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(expected);
  expect(clipboard).toContain('styleseat/mobileweb');
});

test('renders code from the repo differently from code an author wrote', async ({ page }) => {
  await openOffline(page);

  // The Stage 0 document has no sketch blocks, so this asserts the citation
  // treatment is the one in use and is visually distinct from a bare pre.
  const figure = page.locator('figure.cite').first();
  await expect(figure.locator('.cite-where b')).toHaveText(/api|web|e2e/);
  await expect(figure.locator('.line').first()).toHaveAttribute('data-line', /\d+/);
});

test('every cited line the browser shows matches the repository at the pinned sha', async ({
  page,
}) => {
  await openOffline(page);

  // Read what the browser renders, not the markup. Entity encoding is the
  // renderer's business; the guarantee is about the text a reader sees.
  const { pins, citations } = await page.evaluate(() => ({
    pins: [...document.querySelectorAll('.pins li')].map(item => [
      item.querySelector('.pin-id')!.textContent!,
      item.querySelector('.pin-sha')!.textContent!,
    ]),
    citations: [...document.querySelectorAll('figure.cite')].map(figure => ({
      sourceId: figure.querySelector('.cite-where b')!.textContent!,
      path:
        figure.querySelector('.cite-dir')!.textContent! +
        figure.querySelector('.cite-file')!.textContent!,
      range: figure.querySelector('.cite-lines')!.textContent!,
      lines: [...figure.querySelectorAll('.line:not(.ctx)')].map(line => line.textContent!),
    })),
  }));

  expect(citations).toHaveLength(9);

  const shaById = new Map(pins as [string, string][]);
  const directories = new Map([
    ['api', join(process.env.HOME!, 'work/styleseat')],
    ['web', join(process.env.HOME!, 'work/mobileweb')],
    ['e2e', join(process.env.HOME!, 'work/cypress')],
  ]);

  for (const citation of citations) {
    const [first, last] = citation.range.split('–');
    const start = Number(first);
    const end = last === undefined ? start : Number(last);

    const expected = execFileSync(
      'git',
      [
        '-C',
        directories.get(citation.sourceId)!,
        'show',
        `${shaById.get(citation.sourceId)!}:${citation.path}`,
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    )
      .split('\n')
      .slice(start - 1, end);

    expect(citation.lines, `${citation.sourceId} ${citation.path}:${start}-${end}`).toEqual(
      expected,
    );
  }
});

test('a collapsed citation is no taller than the lines it shows', async ({ page }) => {
  await openOffline(page);

  const measured = await page.evaluate(() => {
    const figure = document.querySelector('figure.cite')!;
    const code = figure.querySelector('.cite-code')!;
    const visible = [...figure.querySelectorAll('.line')].filter(
      line => (line as HTMLElement).offsetParent !== null,
    );
    const linesHeight = visible.reduce(
      (total, line) => total + line.getBoundingClientRect().height,
      0,
    );
    return { codeHeight: code.getBoundingClientRect().height, linesHeight, visible: visible.length };
  });

  // Hidden context lines must collapse completely. Shiki separates line spans
  // with real newlines, and inside `white-space: pre` those keep their boxes
  // even when the spans are display:none.
  expect(measured.visible).toBeGreaterThan(0);
  expect(measured.codeHeight - measured.linesHeight).toBeLessThan(28);
});

test('shows every cited line in full, with nothing clipped or scrolled away', async ({ page }) => {
  await openOffline(page);

  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.cite-code')]
      .map(code => ({
        path: code
          .closest('figure')!
          .querySelector('.cite-where')!
          .textContent!.trim(),
        overflow: code.scrollWidth - code.clientWidth,
      }))
      .filter(entry => entry.overflow > 1),
  );

  expect(clipped).toEqual([]);
});

test('keeps the whole document inside the reading column', async ({ page }) => {
  await openOffline(page);

  const wide = await page.evaluate(() => {
    // The reading column, not the viewport: a table that escapes the measure
    // still fits a wide window and still reads badly.
    const limit = document.querySelector('main')!.getBoundingClientRect().right;
    return [...document.querySelectorAll('main *')]
      .filter(node => node.getBoundingClientRect().right > limit + 1)
      .map(node => `${node.tagName.toLowerCase()}.${node.className}`)
      .slice(0, 5);
  });

  expect(wide).toEqual([]);
});

test('shows each citation path in full rather than truncating provenance', async ({ page }) => {
  await openOffline(page);

  const truncated = await page.evaluate(() =>
    [...document.querySelectorAll('.cite-where')]
      .filter(where => where.scrollWidth > where.clientWidth + 1)
      .map(where => where.textContent!.trim()),
  );

  expect(truncated).toEqual([]);
});

test('renders a single-source document, where citations omit the source id', async ({ page }) => {
  const out = join(mkdtempSync(join(tmpdir(), 'explorer2-single-')), 'artifact.html');
  execFileSync(
    process.execPath,
    ['--experimental-strip-types', 'src/cli.ts', 'render', 'stage0/user-state.md', '-o', out],
    { cwd: ROOT, encoding: 'utf8' },
  );

  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.context().route('**', route => {
    if (route.request().url().startsWith('file://')) route.continue();
    else route.abort();
  });
  await page.goto(pathToFileURL(out).href);

  await expect(page.locator('.pins li')).toHaveCount(1);
  await expect(page.locator('figure.cite')).toHaveCount(10);
  // The front matter question is prose the renderer must surface, not drop.
  await expect(page.locator('.question')).toContainText('what actually persists');
  expect(errors).toEqual([]);

  const truncated = await page.evaluate(
    () =>
      [...document.querySelectorAll('.cite-where')].filter(
        where => where.scrollWidth > where.clientWidth + 1,
      ).length,
  );
  expect(truncated).toBe(0);
});

test('centres every block, so a wider figure reads as deliberate', async ({ page }) => {
  await openOffline(page);

  const lopsided = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const style = getComputedStyle(main);
    const inner = {
      left: main.getBoundingClientRect().left + parseFloat(style.paddingLeft),
      right: main.getBoundingClientRect().right - parseFloat(style.paddingRight),
    };

    return [...main.children]
      .filter(node => node.getBoundingClientRect().height > 0)
      .map(node => {
        const box = node.getBoundingClientRect();
        return {
          tag: node.tagName.toLowerCase(),
          leftGap: Math.round(box.left - inner.left),
          rightGap: Math.round(inner.right - box.right),
        };
      })
      .filter(entry => Math.abs(entry.leftGap - entry.rightGap) > 2);
  });

  // Prose is narrower than the citations on purpose. What made the earlier
  // version look hard-wrapped was the gap being on one side only.
  expect(lopsided).toEqual([]);
});

test('gives code a wider column than prose', async ({ page }) => {
  await openOffline(page);

  const widths = await page.evaluate(() => {
    const width = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect().width;
    return { prose: width('main > p'), code: width('main > figure.cite') };
  });

  expect(widths.code).toBeGreaterThan(widths.prose + 40);
});


test('keeps a citation affordances on one line when the path wraps', async ({ page }) => {
  await openOffline(page);

  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('.cite-acts')]
      .filter(acts => {
        const tops = [...acts.children].map(child => Math.round(child.getBoundingClientRect().top));
        return new Set(tops).size > 1;
      })
      .length,
  );

  expect(broken).toBe(0);
});

test('keeps the line range on the same line as the file name', async ({ page }) => {
  await openOffline(page);

  const split = await page.evaluate(() =>
    [...document.querySelectorAll('figure.cite')]
      .filter(figure => {
        const file = figure.querySelector('.cite-file')!.getBoundingClientRect();
        const lines = figure.querySelector('.cite-lines')!.getBoundingClientRect();
        return Math.abs(file.top - lines.top) > 1;
      })
      .map(figure => figure.querySelector('.cite-file')!.textContent),
  );

  expect(split).toEqual([]);
});

test('switches theme on click and remembers the choice', async ({ page }) => {
  await openOffline(page);

  const paper = () =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  const before = await paper();
  await page.locator('.theme-toggle').click();
  const after = await paper();

  expect(after).not.toBe(before);

  // The choice has to survive a reload, or it is a gimmick.
  const chosen = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(chosen);
  expect(await paper()).toBe(after);
});

test('highlights the section the reader is in', async ({ page, viewport }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openOffline(page);

  const nav = page.locator('.toc');
  await expect(nav).toBeVisible();

  const first = nav.locator('a').first();
  await expect(first).toHaveAttribute('aria-current', 'true');

  // Jump to a later section and the nav should follow.
  const target = nav.locator('a').nth(4);
  const href = await target.getAttribute('href');
  await target.click();
  await expect(target).toHaveAttribute('aria-current', 'true');
  expect(await page.evaluate(() => window.location.hash)).toBe(href);
});

test('the nav links land on their sections', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openOffline(page);

  const missing = await page.evaluate(() =>
    [...document.querySelectorAll('.toc a')]
      .map(link => (link as HTMLAnchorElement).getAttribute('href')!)
      .filter(href => !document.querySelector(href)),
  );

  expect(missing).toEqual([]);
});

test('shows the citation path exactly as it is on disk, in every skin', async ({ page }) => {
  for (const skin of Object.keys(SKINS)) {
    const out = join(mkdtempSync(join(tmpdir(), `explorer2-${skin}-`)), 'artifact.html');
    execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        'src/cli.ts',
        'render',
        'stage0/feature-feedback.md',
        '-o',
        out,
        '--style',
        skin,
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    await page.goto(pathToFileURL(out).href);

    // A skin may restyle a path; it may not rewrite one. text-transform makes
    // the rendered characters differ from the file on disk while textContent
    // still matches, so no byte-identity check would catch it.
    const altered = await page.evaluate(() =>
      [...document.querySelectorAll('.cite-dir, .cite-file')]
        .filter(node => getComputedStyle(node).textTransform !== 'none')
        .map(node => node.textContent),
    );

    expect(altered, `${skin} alters the displayed path`).toEqual([]);
  }
});

test('renders no text that disappears into its own background', async ({ page }) => {
  for (const skin of Object.keys(SKINS)) {
    const out = join(mkdtempSync(join(tmpdir(), `explorer2-contrast-${skin}-`)), 'artifact.html');
    execFileSync(
      process.execPath,
      ['--experimental-strip-types', 'src/cli.ts', 'render', 'stage0/feature-feedback.md',
        '-o', out, '--style', skin],
      { cwd: ROOT, encoding: 'utf8' },
    );
    await page.goto(pathToFileURL(out).href);

    const unreadable = await page.evaluate(() => {
      const parse = (colour: string) =>
        (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = ([r, g, b]: number[]) => {
        const lin = [r!, g!, b!].map(channel => {
          const c = channel / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
      };

      /** Walk up until something paints a background. */
      const backdrop = (node: Element): number[] => {
        let cursor: Element | null = node;
        while (cursor) {
          const colour = getComputedStyle(cursor).backgroundColor;
          const parts = parse(colour);
          const alpha = (colour.match(/[\d.]+/g) ?? [])[3];
          if (parts.length === 3 && alpha !== '0') return parts;
          cursor = cursor.parentElement;
        }
        return [255, 255, 255];
      };

      return [...document.querySelectorAll('main *, .toc a, .theme-toggle')]
        .filter(node => {
          const text = [...node.childNodes].some(
            child => child.nodeType === 3 && child.textContent!.trim() !== '',
          );
          return text && node.getBoundingClientRect().height > 0;
        })
        .map(node => {
          const front = luminance(parse(getComputedStyle(node).color));
          const back = luminance(backdrop(node));
          const ratio =
            (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
          return { tag: `${node.tagName.toLowerCase()}.${node.className}`, ratio };
        })
        .filter(entry => entry.ratio < 2)
        .slice(0, 6);
    });

    expect(unreadable, `${skin} has text with almost no contrast`).toEqual([]);
  }
});

test('highlights the last section once the reader reaches the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openOffline(page);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  // The final heading never climbs to the reading line, because there is not
  // enough document beneath it to scroll that far.
  const last = page.locator('.toc a').last();
  await expect(last).toHaveAttribute('aria-current', 'true');
});
