import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseDocument } from '../src/parse.ts';
import { resolveDocument } from '../src/resolve.ts';
import { renderDocument } from '../src/render.ts';
import { languageForPath } from '../src/highlight.ts';
import { DEFAULT_SKIN, SKINS } from '../src/styles/skins.ts';
import { addUncheckedBranch, addWorktree, makeRepo, numberedLines } from './helpers/repo.ts';

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
    repo: acme/web
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

    expect(decoded).toContain('acme/web');
    expect(decoded).toContain(sha);
    expect(decoded).toContain('src/widen.ts');
    expect(decoded).toContain('3-8');
  });

  it('gives a section ask a prompt naming the section and every pinned sha', () => {
    const heading = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/)![0];
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

    expect(out).toMatch(/<h2[ >]/);
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

  it('loads no resource over the network', () => {
    // Anchor hrefs are user-initiated navigation, not a resource the page
    // fetches. What must not appear is anything the browser would go and get.
    expect(html).not.toMatch(/<link[^>]/);
    expect(html).not.toMatch(/<(?:script|img|iframe|source)[^>]+src\s*=/);
    expect(html).not.toContain('@import');
    expect(html).not.toMatch(/url\(\s*['"]?https?:/);
  });

  it('inlines its styles and script rather than linking them', () => {
    expect(html).toContain('<style>');
    expect(html).toContain('<script>');
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
  });
});

describe('prose-led navigator documents', () => {
  it('renders readable narrative with section navigation and pinned source identity without citations', async () => {
    const repo = makeRepo({ 'src/architecture.ts': numberedLines(8) });
    const out = await render(`---
title: Navigator orientation
sources:
  - id: web
    repo: acme/web
    path: ${repo.path}
    head: main
---

The architecture map names the boundary before following one behavior.

## The map

Responsibilities and consequences are explained in prose.
`);

    expect(out).toContain('The architecture map names the boundary');
    expect(out).toContain('<nav class="toc"');
    expect(out).toContain('href="#the-map"');
    expect(out).toContain('data-ask=');
    expect(out).toContain('acme/web');
    expect(out).toContain(repo.sha);
    expect(out).not.toContain('<figure class="cite"');
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

describe('highlighting is resolved against the whole file', () => {
  const WITH_DOCSTRING = [
    'class Thing:',                             // 1
    '    """A docstring that spans',            // 2
    '',                                         // 3
    '    several lines and closes below.',      // 4
    '    """',                                  // 5
    '',                                         // 6
    '    def create(self, data):',              // 7
    '        name = data["name"]',              // 8
    '        return {"name": name}',            // 9
    '',                                         // 10
  ].join('\n');

  /** Distinct colours among the cited lines only, ignoring context and the pre. */
  function citedColours(html: string): number {
    const figure = html.match(/<figure class="cite"[\s\S]*?<\/figure>/)![0];
    const code = figure.match(/<code[^>]*>([\s\S]*?)<\/code>/)![1]!;
    const cited = code
      .split('\n')
      .filter(line => line.includes('class="line"') && !line.includes('ctx'));
    return new Set(cited.flatMap(line => line.match(/--shiki-light:[^;"]+/g) ?? [])).size;
  }

  function docFor(repoPath: string, body: string): string {
    return `---
title: Fixture
sources:
  - id: api
    path: ${repoPath}
    head: main
---
${body}`;
  }

  it('highlights an excerpt whose context window opens on a closing docstring', async () => {
    const repo = makeRepo({ 'a.py': WITH_DOCSTRING });
    // Citing 8-9 with three lines of context starts the window on line 5, which
    // is the closing `"""`. Highlighting from there reads it as an opening quote
    // and paints the rest of the excerpt as one string.
    const parsed = parseDocument(docFor(repo.path, ':::cite a.py:8-9\n:::\n'));
    const out = await renderDocument(parsed, resolveDocument(parsed, { contextLines: 3 }), {});

    expect(citedColours(out)).toBeGreaterThan(2);
  });

  it('gives a cited line the same markup however much context surrounds it', async () => {
    const repo = makeRepo({ 'a.py': WITH_DOCSTRING });
    const parsed = parseDocument(docFor(repo.path, ':::cite a.py:8-8\n:::\n'));

    const windowed = await renderDocument(parsed, resolveDocument(parsed, { contextLines: 3 }), {});
    const bare = await renderDocument(parsed, resolveDocument(parsed, { contextLines: 0 }), {});

    const citedLine = (html: string) =>
      html.match(/<span class="line" data-line="8">([\s\S]*?)<\/span><\/span>/)![1];

    expect(citedLine(windowed)).toBe(citedLine(bare));
  });
});

describe('links out of the artifact', () => {
  function docFor(repoPath: string, extra: string, body: string): string {
    return `---
title: Fixture
sources:
  - id: web
    repo: acme/web
    path: ${repoPath}
    head: main
${extra}---
${body}`;
  }

  it('links a citation to the GitHub blob at the pinned sha and line range', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(20) });
    const out = await render(docFor(repo.path, '', ':::cite src/a.ts:4-8\n:::\n'));

    expect(out).toContain(
      `href="https://github.com/acme/web/blob/${repo.sha}/src/a.ts#L4-L8"`,
    );
  });

  it('uses a single line anchor for a single line citation', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(20) });
    const out = await render(docFor(repo.path, '', ':::cite src/a.ts:9\n:::\n'));

    expect(out).toContain('#L9"');
    expect(out).not.toContain('#L9-L9');
  });

  it('links a citation to the file in an editor at the cited line', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(20) });
    const out = await render(docFor(repo.path, '', ':::cite src/a.ts:4-8\n:::\n'));

    expect(out).toContain(`href="vscode://file${repo.path}/src/a.ts:4"`);
  });

  it('omits the GitHub link when the source declares no repo', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(20) });
    const parsed = parseDocument(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
:::cite src/a.ts:1-2
:::
`);
    const out = await renderDocument(parsed, resolveDocument(parsed, { contextLines: 2 }), {});

    expect(out).not.toContain('github.com');
    expect(out).toContain('vscode://file');
  });

  it('links each pull request a source names in front matter', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(20) });
    const out = await render(
      docFor(repo.path, '    prs: [12800, 12805]\n', ':::cite src/a.ts:1-2\n:::\n'),
    );

    expect(out).toContain('href="https://github.com/acme/web/pull/12800"');
    expect(out).toContain('href="https://github.com/acme/web/pull/12805"');
    expect(out).toContain('#12805');
  });
});

describe('the editor link', () => {
  function docFor(repoPath: string, head: string, body: string): string {
    return `---
title: Fixture
sources:
  - id: web
    repo: acme/web
    path: ${repoPath}
    head: ${head}
---
${body}`;
  }

  it('links the checkout when it holds the pinned commit', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(20) });
    const out = await render(docFor(repo.path, 'main', ':::cite src/a.ts:4-8\n:::\n'));

    expect(out).toContain(`href="vscode://file${repo.path}/src/a.ts:4"`);
  });

  it('offers no editor link when no checkout holds the pinned commit', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(20) });
    addUncheckedBranch(repo, 'feature', { 'src/b.ts': numberedLines(30) });

    const out = await render(docFor(repo.path, 'feature', ':::cite src/b.ts:2-4\n:::\n'));

    // src/b.ts exists only on the un-checked-out branch, so a working-tree link
    // would open nothing.
    expect(out).not.toContain('vscode://');
    expect(out).toContain('github.com');
  });

  it('links the worktree that holds the pinned commit', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(20) });
    addUncheckedBranch(repo, 'feature', { 'src/b.ts': numberedLines(30) });
    const worktree = addWorktree(repo, 'feature');

    const out = await render(docFor(repo.path, 'feature', ':::cite src/b.ts:2-4\n:::\n'));

    expect(out).toContain(`href="vscode://file${worktree}/src/b.ts:2"`);
  });

  it('ignores a worktree whose directory is gone', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(20) });
    addUncheckedBranch(repo, 'feature', { 'src/b.ts': numberedLines(30) });
    const worktree = addWorktree(repo, 'feature');
    // Still listed, and still reporting the pinned HEAD, but there is nothing
    // behind it. `git worktree list` marks this prunable after the HEAD line,
    // which is why deciding on the HEAD line alone linked a path that is gone.
    rmSync(worktree, { recursive: true, force: true });

    const out = await render(docFor(repo.path, 'feature', ':::cite src/b.ts:2-4\n:::\n'));

    expect(out).not.toContain('vscode://');
  });

  it('lets a reader point the editor link at their own editor', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(20) });

    const out = await render(docFor(repo.path, 'main', ':::cite src/a.ts:4-8\n:::\n'), {
      editorUrl: 'zed://file{path}:{line}',
    });

    expect(out).toContain(`href="zed://file${repo.path}/src/a.ts:4"`);
    expect(out).not.toContain('vscode://');
  });
});

describe('the citation header', () => {
  it('keeps the line range next to the path it belongs to', async () => {
    const repo = makeRepo({ 'a/very/long/path/to/some/module/file.ts': numberedLines(40) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
:::cite a/very/long/path/to/some/module/file.ts:32-35
:::
`);

    const where = out.match(/<span class="cite-where">([\s\S]*?)<\/span>\s*<span class="cite-acts"/);
    expect(where, 'header should be where-then-actions').not.toBeNull();
    expect(where![1]).toContain('32–35');
  });

  it('groups the affordances so they stay together when the path wraps', async () => {
    const repo = makeRepo({ 'a.ts': numberedLines(40) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    repo: acme/web
    path: ${repo.path}
    head: main
---
:::cite a.ts:2-3
:::
`);

    const acts = out.match(/<span class="cite-acts">([\s\S]*?)<\/span><\/div>/)![1]!;
    expect(acts).toContain('cite-more');
    expect(acts).toContain('github');
    expect(acts).toContain('ask');
  });

  it('distinguishes the file name from its directory', async () => {
    const repo = makeRepo({ 'deep/dir/file.ts': numberedLines(40) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
:::cite deep/dir/file.ts:2-3
:::
`);

    expect(out).toContain('<span class="cite-dir">deep/dir/</span>');
    expect(out).toContain('<span class="cite-file">file.ts</span>');
  });
});

describe('section navigation', () => {
  async function withHeadings() {
    const repo = makeRepo({ 'a.ts': numberedLines(10) });
    return render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
## What shipped

Text.

## One ask per pro, per week

Text.

### A sub-heading

:::cite a.ts:1-2
:::
`);
  }

  it('gives every heading a stable id', async () => {
    const out = await withHeadings();

    expect(out).toContain('<h2 id="what-shipped"');
    expect(out).toContain('<h2 id="one-ask-per-pro-per-week"');
    expect(out).toContain('<h3 id="a-sub-heading"');
  });

  it('lists the sections in a nav that links to them', async () => {
    const out = await withHeadings();
    const nav = out.match(/<nav class="toc"[\s\S]*?<\/nav>/)![0];

    expect(nav).toContain('href="#what-shipped"');
    expect(nav).toContain('href="#one-ask-per-pro-per-week"');
    expect(nav).toContain('What shipped');
    expect(nav.indexOf('#what-shipped')).toBeLessThan(nav.indexOf('#one-ask-per-pro-per-week'));
  });

  it('marks depth so the nav can indent sub-sections', async () => {
    const out = await withHeadings();
    const nav = out.match(/<nav class="toc"[\s\S]*?<\/nav>/)![0];

    expect(nav).toContain('class="toc-2"');
    expect(nav).toContain('class="toc-3"');
  });

  it('omits the nav when a document has no headings', async () => {
    const repo = makeRepo({ 'a.ts': numberedLines(10) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
Just prose, no headings.
`);

    expect(out).not.toContain('<nav class="toc"');
  });

  it('keeps ids unique when two headings share a title', async () => {
    const repo = makeRepo({ 'a.ts': numberedLines(10) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
## Notes

## Notes
`);

    expect(out).toContain('id="notes"');
    expect(out).toContain('id="notes-2"');
  });
});

describe('the theme control', () => {
  it('offers a control that names the two themes', async () => {
    const repo = makeRepo({ 'a.ts': numberedLines(10) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
## Heading
`);

    expect(out).toContain('class="theme-toggle"');
    expect(out).toMatch(/aria-label="[^"]*reading surface/i);
  });

  it('ships every reading surface, and names the default in the markup', async () => {
    const repo = makeRepo({ 'a.ts': numberedLines(10) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
## Heading
`);

    // The attribute is in the markup, not set by script, so a reader with
    // scripting off gets a designed page rather than unstyled tokens.
    expect(out).toContain(`<html lang="en" data-skin="${DEFAULT_SKIN}">`);
    for (const name of Object.keys(SKINS)) {
      expect(out, name).toContain(`:root[data-skin="${name}"]`);
    }
  });

  it('styles both themes without relying on the system preference alone', async () => {
    const repo = makeRepo({ 'a.ts': numberedLines(10) });
    const out = await render(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
## Heading
`);

    expect(out).toContain('[data-theme="dark"]');
    expect(out).toContain('[data-theme="light"]');
    expect(out).toContain('prefers-color-scheme: dark');
  });
});

describe('linked file references', () => {
  const TREE = {
    'src/features/statements/useStatement.ts': numberedLines(6),
    'docs/notes.md': numberedLines(6),
  };

  function docFor(repoPath: string, body: string): string {
    return `---
title: Fixture
sources:
  - id: web
    repo: acme/web
    path: ${repoPath}
    head: main
---
${body}`;
  }

  it('links a named file to the blob at the pinned sha', async () => {
    const repo = makeRepo(TREE);
    const out = await render(docFor(repo.path, 'Read `web statements/useStatement.ts` first.\n'));

    expect(out).toContain(
      `href="https://github.com/acme/web/blob/${repo.sha}/src/features/statements/useStatement.ts"`,
    );
  });

  it('shows the path as written and names the full path in the title', async () => {
    const repo = makeRepo(TREE);
    const out = await render(docFor(repo.path, 'Read `web statements/useStatement.ts` first.\n'));
    const link = out.match(/<a class="file-ref"[^>]*>[\s\S]*?<\/a>/)![0];

    expect(link).toContain('web statements/useStatement.ts');
    expect(link).toContain('title="src/features/statements/useStatement.ts');
  });

  it('leaves prose code untouched when it names no file', async () => {
    const repo = makeRepo(TREE);
    const out = await render(docFor(repo.path, 'The `addValues` effect matters.\n'));

    const body = out.slice(out.indexOf('<main>'));
    expect(body).toContain('<code>addValues</code>');
    expect(body).not.toContain('file-ref');
  });

  it('links every row of a file table', async () => {
    const repo = makeRepo(TREE);
    const out = await render(
      docFor(
        repo.path,
        '| file | why |\n|---|---|\n| `web statements/useStatement.ts` | The wire contract. |\n| `web docs/notes.md` | The read path. |\n',
      ),
    );

    expect([...out.matchAll(/class="file-ref"/g)]).toHaveLength(2);
  });
});
