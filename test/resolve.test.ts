import { execFileSync } from 'node:child_process';
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

describe('file references in prose', () => {
  const TREE = {
    'src/features/statements/types.ts': numberedLines(5),
    'src/features/statements/useStatement.ts': numberedLines(5),
    'packages/ui/src/theme/types.ts': numberedLines(5),
    'docs/notes.md': numberedLines(5),
  };

  function doc(repoPath: string, body: string, id = 'web'): string {
    return `---
title: Fixture
sources:
  - id: ${id}
    repo: acme/web
    path: ${repoPath}
    head: main
  - id: api
    repo: acme/platform
    path: ${repoPath}
    head: main
---
${body}`;
  }

  it('resolves an exact path named with its source id', () => {
    const repo = makeRepo(TREE);
    const parsed = parseDocument(doc(repo.path, 'See `web docs/notes.md` for the read path.\n'));

    const resolution = resolveDocument(parsed);

    expect(resolution.failures).toEqual([]);
    expect(resolution.references.get('web docs/notes.md')?.path).toBe('docs/notes.md');
  });

  it('resolves an abbreviated path when exactly one file ends with it', () => {
    const repo = makeRepo(TREE);
    const parsed = parseDocument(doc(repo.path, 'Read `web statements/useStatement.ts`.\n'));

    const resolution = resolveDocument(parsed);

    expect(resolution.references.get('web statements/useStatement.ts')?.path).toBe(
      'src/features/statements/useStatement.ts',
    );
  });

  it('fails when an abbreviated path matches more than one file', () => {
    const repo = makeRepo(TREE);
    const parsed = parseDocument(doc(repo.path, 'Read `web types.ts`.\n'));

    const resolution = resolveDocument(parsed);

    expect(resolution.failures[0]!.code).toBe('ambiguous-reference');
    expect(resolution.failures[0]!.message).toContain('types.ts');
    expect(resolution.failures[0]!.message).toContain('2');
  });

  it('fails when a named path is not in the tree at all', () => {
    const repo = makeRepo(TREE);
    const parsed = parseDocument(doc(repo.path, 'Read `web nope/gone.ts`.\n'));

    const resolution = resolveDocument(parsed);

    expect(resolution.failures[0]!.code).toBe('missing-reference');
    expect(resolution.failures[0]!.message).toContain('nope/gone.ts');
  });

  it('leaves prose that is not a file reference alone', () => {
    const repo = makeRepo(TREE);
    const parsed = parseDocument(
      doc(repo.path, 'The `IS NOT NULL AND <> \'\'` filter and `addValues` both matter.\n'),
    );

    const resolution = resolveDocument(parsed);

    expect(resolution.failures).toEqual([]);
    expect(resolution.references.size).toBe(0);
  });

  it('ignores a reference inside a fenced block', () => {
    const repo = makeRepo(TREE);
    const parsed = parseDocument(
      doc(repo.path, 'Example:\n\n```\n`web nope/gone.ts`\n```\n'),
    );

    const resolution = resolveDocument(parsed);

    expect(resolution.failures).toEqual([]);
  });
});

describe('bare file references in a single-source document', () => {
  function doc(repoPath: string, body: string): string {
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

  const TREE = {
    'app/scripts/store/UserState/UserState.model.ts': numberedLines(5),
    'app/scripts/hooks/useUserStateRedux.ts': numberedLines(5),
    'app/scripts/store/ProviderGoals.model.ts': numberedLines(5),
  };

  it('resolves a bare path when the document declares one source', () => {
    const repo = makeRepo(TREE);
    const parsed = parseDocument(doc(repo.path, 'See `store/UserState/UserState.model.ts`.\n'));

    const resolution = resolveDocument(parsed);

    expect(resolution.failures).toEqual([]);
    expect(resolution.references.get('store/UserState/UserState.model.ts')?.path).toBe(
      'app/scripts/store/UserState/UserState.model.ts',
    );
  });

  it('never fails on a bare reference, because prose is not a claim about a path', () => {
    const repo = makeRepo(TREE);
    const parsed = parseDocument(
      doc(repo.path, 'The `ProviderGoals.model` selector and `some/thing/absent.ts`.\n'),
    );

    const resolution = resolveDocument(parsed);

    expect(resolution.failures).toEqual([]);
    expect(resolution.references.size).toBe(0);
  });

  it('leaves a bare symbol alone even when a file shares its name', () => {
    const repo = makeRepo(TREE);
    const parsed = parseDocument(doc(repo.path, 'The `refreshUserState` effect.\n'));

    const resolution = resolveDocument(parsed);

    expect(resolution.references.size).toBe(0);
  });

  it('requires the source id when a document declares several sources', () => {
    const repo = makeRepo(TREE);
    const parsed = parseDocument(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
  - id: api
    path: ${repo.path}
    head: main
---
See \`hooks/useUserStateRedux.ts\`.
`);

    const resolution = resolveDocument(parsed);

    expect(resolution.references.size).toBe(0);
    expect(resolution.failures).toEqual([]);
  });
});

describe('pinning a source to a recorded sha', () => {
  it('accepts a recorded sha that still matches the head ref', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(10) });
    const parsed = parseDocument(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
    sha: ${repo.sha}
---
:::cite src/a.ts:1-2
:::
`);

    const resolution = resolveDocument(parsed);

    expect(resolution.failures).toEqual([]);
    expect(resolution.sources[0]!.sha).toBe(repo.sha);
  });

  it('fails when the branch has moved away from the recorded sha', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(10) });
    const stale = repo.sha;
    // The branch is rebased or amended, as a stacked branch routinely is.
    writeFileSync(`${repo.path}/src/a.ts`, numberedLines(40));
    execFileSync('git', ['-C', repo.path, 'commit', '--quiet', '-am', 'moved']);

    const parsed = parseDocument(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
    sha: ${stale}
---
:::cite src/a.ts:1-2
:::
`);

    const resolution = resolveDocument(parsed);

    expect(resolution.failures[0]!.code).toBe('moved-head');
    expect(resolution.failures[0]!.message).toContain(stale.slice(0, 10));
    expect(resolution.failures[0]!.message).toContain('main');
  });

  it('reads blobs at the recorded sha, not at the branch tip', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(10) });
    const pinned = repo.sha;
    writeFileSync(`${repo.path}/src/a.ts`, 'rewritten\n'.repeat(10));
    execFileSync('git', ['-C', repo.path, 'commit', '--quiet', '-am', 'moved']);

    const parsed = parseDocument(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: ${pinned}
    sha: ${pinned}
---
:::cite src/a.ts:3-3
:::
`);

    const resolution = resolveDocument(parsed);

    expect(resolution.failures).toEqual([]);
    expect(resolution.citations[0]!.lines).toEqual(['line 3']);
  });

  it('reports the head it wanted so the author can repin deliberately', () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(10) });
    const stale = repo.sha;
    writeFileSync(`${repo.path}/src/a.ts`, numberedLines(40));
    execFileSync('git', ['-C', repo.path, 'commit', '--quiet', '-am', 'moved']);
    const moved = execFileSync('git', ['-C', repo.path, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();

    const parsed = parseDocument(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
    sha: ${stale}
---
:::cite src/a.ts:1-2
:::
`);

    const resolution = resolveDocument(parsed);

    expect(resolution.failures[0]!.message).toContain(moved.slice(0, 10));
  });
});
