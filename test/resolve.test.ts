import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../src/parse.ts';
import { resolveDocument } from '../src/resolve.ts';
import { makeRepo, numberedLines } from './helpers/repo.ts';

function docFor(repoPath: string, body: string, head = 'main'): string {
  return `---
title: Fixture
sources:
  - id: web
    path: ${repoPath}
    head: ${head}
---
${body}`;
}

describe('resolveDocument', () => {
  it('reads exactly the cited lines from git', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(10) });
    const doc = parseDocument(docFor(repo.path, '\n:::cite src/a.ts:3-5\n:::\n'));

    const resolution = resolveDocument(doc);

    expect(resolution.failures).toEqual([]);
    expect(resolution.citations[0]!.lines).toEqual(['line 3', 'line 4', 'line 5']);
  });

  it('pins the head ref to a concrete sha', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(10) });
    const doc = parseDocument(docFor(repo.path, '\n:::cite src/a.ts:1-1\n:::\n'));

    const resolution = resolveDocument(doc);

    expect(resolution.sources[0]!.sha).toBe(repo.sha);
  });

  it('reads the blob at the pinned sha, not the working tree', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(10) });
    writeFileSync(`${repo.path}/src/a.ts`, 'tampered\n');

    const doc = parseDocument(docFor(repo.path, '\n:::cite src/a.ts:1-1\n:::\n'));
    const resolution = resolveDocument(doc);

    expect(resolution.citations[0]!.lines).toEqual(['line 1']);
  });

  it('carries context lines either side of the citation', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(40) });
    const doc = parseDocument(docFor(repo.path, '\n:::cite src/a.ts:20-21\n:::\n'));

    const resolution = resolveDocument(doc, { contextLines: 3 });

    expect(resolution.citations[0]!.before).toEqual(['line 17', 'line 18', 'line 19']);
    expect(resolution.citations[0]!.after).toEqual(['line 22', 'line 23', 'line 24']);
  });

  it('clamps context at the start and end of the file', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(4) });
    const doc = parseDocument(docFor(repo.path, '\n:::cite src/a.ts:1-4\n:::\n'));

    const resolution = resolveDocument(doc, { contextLines: 5 });

    expect(resolution.citations[0]!.before).toEqual([]);
    expect(resolution.citations[0]!.after).toEqual([]);
  });

  it('expands a leading ~ in a source path', () => {
    const doc = parseDocument(`---
title: Fixture
sources:
  - id: web
    path: ~/definitely-not-a-real-directory-explorer2
    head: main
---
:::cite src/a.ts:1-1
:::
`);

    const resolution = resolveDocument(doc);

    expect(resolution.failures[0]!.message).toContain(process.env.HOME!);
  });
});

describe('resolveDocument failures', () => {
  it('reports a line range that runs past the end of the file', () => {
    const repo = makeRepo({ 'src/x.ts': numberedLines(41) });
    const doc = parseDocument(docFor(repo.path, '\n:::cite src/x.ts:55-60\n:::\n'));

    const resolution = resolveDocument(doc);

    expect(resolution.failures).toHaveLength(1);
    expect(resolution.failures[0]!.code).toBe('range-past-eof');
    expect(resolution.failures[0]!.message).toBe('web src/x.ts has 41 lines, cited 55-60');
  });

  it('reports a file that is not present at the pinned ref', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(3) });
    const doc = parseDocument(docFor(repo.path, '\n:::cite src/gone.ts:1-1\n:::\n'));

    const resolution = resolveDocument(doc);

    expect(resolution.failures[0]!.code).toBe('missing-file');
    expect(resolution.failures[0]!.message).toContain('src/gone.ts');
    expect(resolution.failures[0]!.message).toContain('main');
  });

  it('reports an unknown source id', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(3) });
    const doc = parseDocument(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
  - id: api
    path: ${repo.path}
    head: main
---
:::cite nope src/a.ts:1-1
:::
`);

    const resolution = resolveDocument(doc);

    expect(resolution.failures[0]!.code).toBe('unknown-source');
    expect(resolution.failures[0]!.message).toContain('nope');
    expect(resolution.failures[0]!.message).toContain('web, api');
  });

  it('reports a ref that is not present locally', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(3) });
    const doc = parseDocument(docFor(repo.path, '\n:::cite src/a.ts:1-1\n:::\n', 'no-such-branch'));

    const resolution = resolveDocument(doc);

    expect(resolution.failures[0]!.code).toBe('ref-not-found');
    expect(resolution.failures[0]!.message).toContain('no-such-branch');
  });

  it('reports a repository path that does not exist', () => {
    const doc = parseDocument(`---
title: Fixture
sources:
  - id: web
    path: /definitely/not/a/repo/explorer2
    head: main
---
:::cite src/a.ts:1-1
:::
`);

    const resolution = resolveDocument(doc);

    expect(resolution.failures[0]!.code).toBe('repo-not-found');
  });

  it('reports every failing citation, not just the first', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(3) });
    const doc = parseDocument(
      docFor(repo.path, '\n:::cite src/a.ts:9-9\n:::\n\n:::cite src/gone.ts:1-1\n:::\n'),
    );

    const resolution = resolveDocument(doc);

    expect(resolution.failures.map(f => f.code)).toEqual(['range-past-eof', 'missing-file']);
  });

  it('resolves the citations that work even when others fail', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(3) });
    const doc = parseDocument(
      docFor(repo.path, '\n:::cite src/a.ts:1-1\n:::\n\n:::cite src/gone.ts:1-1\n:::\n'),
    );

    const resolution = resolveDocument(doc);

    expect(resolution.citations).toHaveLength(1);
    expect(resolution.failures).toHaveLength(1);
  });
});
