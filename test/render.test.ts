import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseDocument } from '../src/parse.ts';
import { resolveDocument } from '../src/resolve.ts';
import { renderDocument } from '../src/render.ts';
import { languageForPath } from '../src/highlight.ts';
import { makeRepo, numberedLines } from './helpers/repo.ts';

/** Recover the visible text of one rendered region, tags and entities removed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    // Shiki emits numeric entities as well as named ones, so decode both.
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/** The lines a figure marks as cited, in order. */
function citedLines(html: string): string[] {
  const figure = html.match(/<figure class="cite"[\s\S]*?<\/figure>/)![0];
  return [...figure.matchAll(/<span class="line"([^>]*)>([\s\S]*?)<\/span><\/span>/g)]
    .filter(m => !m[1]!.includes('ctx'))
    .map(m => textOf(`${m[2]}</span>`));
}

async function render(docText: string, options = {}) {
  const doc = parseDocument(docText);
  const resolution = resolveDocument(doc, { contextLines: 3 });
  return renderDocument(doc, resolution, options);
}

const SOURCE = `import { readFile } from 'node:fs';

/** A doc comment with <angle> & ampersand. */
export function widen(value: string): string {
  if (value === '') {
    return '"empty"';
  }
  return value;
}
`;

describe('renderDocument', () => {
  let repoPath: string;
  let sha: string;
  let html: string;

  beforeAll(async () => {
    const repo = makeRepo({ 'src/widen.ts': SOURCE });
    repoPath = repo.path;
    sha = repo.sha;
    html = await render(`---
title: Fixture
sources:
  - id: web
    repo: styleseat/mobileweb
    path: ${repo.path}
    head: main
---
## A heading

:::cite src/widen.ts:3-8
Why this matters.
:::
`);
  });

  it('renders the cited lines byte-identically to the git blob', () => {
    const fromGit = execFileSync('git', ['-C', repoPath, 'show', `${sha}:src/widen.ts`], {
      encoding: 'utf8',
    })
      .split('\n')
      .slice(2, 8);

    expect(citedLines(html)).toEqual(fromGit);
  });

  it('escapes source that would otherwise be markup, and shows it verbatim', () => {
    // The cited range includes a doc comment containing <angle> & an ampersand.
    expect(html).not.toContain('<angle>');
    expect(citedLines(html)).toContain(
      ' /** A doc comment with <angle> & ampersand. */'.trimStart(),
    );
  });

  it('names the source, path and line range', () => {
    expect(html).toContain('src/widen.ts');
    expect(html).toMatch(/3[–-]8/);
    expect(html).toContain('web');
  });

  it('records the pinned sha in the artifact', () => {
    expect(html).toContain(sha);
  });

  it('carries context lines, marked as context', () => {
    expect(html).toMatch(/class="line ctx"|class="line ctx /);
    expect(textOf(html)).toContain('import { readFile }');
  });

  it('gives a citation ask a prompt naming the repo, sha, path and lines', () => {
    const figure = html.match(/<figure class="cite"[\s\S]*?<\/figure>/)![0];
    const prompt = figure.match(/data-ask="([^"]*)"/)![1]!;
    const decoded = prompt.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");

    expect(decoded).toContain('styleseat/mobileweb');
    expect(decoded).toContain(sha);
    expect(decoded).toContain('src/widen.ts');
    expect(decoded).toContain('3-8');
  });

  it('gives a section ask a prompt naming the section and every pinned sha', () => {
    const heading = html.match(/<h2>[\s\S]*?<\/h2>/)![0];
    const prompt = heading.match(/data-ask="([^"]*)"/)![1]!;

    expect(prompt).toContain('A heading');
    expect(prompt).toContain(sha);
  });

  it('keeps the caption with the citation', () => {
    expect(html).toContain('Why this matters.');
  });

  it('renders markdown headings and tables', async () => {
    const repo = makeRepo({ 'a.txt': numberedLines(3) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
## Heading

| file | why |
|---|---|
| \`a.ts\` | because |
`);

    expect(out).toContain('<h2');
    expect(out).toContain('<table>');
    expect(out).toContain('<td>');
  });

  it('marks a model-written fenced block differently from a citation', async () => {
    const repo = makeRepo({ 'a.txt': numberedLines(3) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
\`\`\`ts
const illustrative = true;
\`\`\`

:::cite a.txt:1-1
:::
`);

    expect(out).toContain('class="sketch"');
    expect(out).toContain('<figure class="cite"');
    expect(out.indexOf('class="sketch"')).toBeLessThan(out.indexOf('<figure class="cite"'));
  });

  it('requests nothing over the network', () => {
    const urls = html.match(/(?:src|href)\s*=\s*"(https?:)?\/\/[^"]*"/g) ?? [];
    expect(urls).toEqual([]);
    expect(html).not.toContain('@import url(');
  });

  it('inlines its styles and script rather than linking them', () => {
    expect(html).toContain('<style>');
    expect(html).toContain('<script>');
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
  });
});

describe('languageForPath', () => {
  it.each([
    ['src/a.ts', 'typescript'],
    ['src/a.tsx', 'tsx'],
    ['app/models.py', 'python'],
    ['spec/a.cy.js', 'javascript'],
    ['config/a.yml', 'yaml'],
    ['notes.md', 'markdown'],
  ])('maps %s to %s', (path, lang) => {
    expect(languageForPath(path)).toBe(lang);
  });

  it('falls back to plain text for an unknown extension', () => {
    expect(languageForPath('LICENSE')).toBe('text');
  });
});

describe('citation captions', () => {
  it('renders inline markdown in a caption rather than showing the source', async () => {
    const repo = makeRepo({ 'a.txt': numberedLines(3) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
:::cite a.txt:1-1
\`verdicts\` is keyed per campaign, **not** the window.
:::
`);

    const caption = out.match(/<figcaption>([\s\S]*?)<\/figcaption>/)![1]!;
    expect(caption).toContain('<code>verdicts</code>');
    expect(caption).toContain('<strong>not</strong>');
    expect(caption).not.toContain('`');
  });
});
