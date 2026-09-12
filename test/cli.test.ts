import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { fileUrl, openCommand, run } from '../src/cli.ts';
import { makeRepo, numberedLines } from './helpers/repo.ts';

const execFileAsync = promisify(execFile);

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      out: (line: string) => out.push(line),
      err: (line: string) => err.push(line),
    },
  };
}

function writeDoc(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'explorer-doc-'));
  const path = join(dir, 'doc.md');
  writeFileSync(path, body);
  return path;
}

function goodDoc(): string {
  const repo = makeRepo({ 'src/a.ts': numberedLines(30) });
  return writeDoc(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
## Heading

:::cite src/a.ts:3-5
:::
`);
}

describe('render needs no ceremony', () => {
  it('writes beside the document when no output is named', async () => {
    const { io, out } = capture();
    const doc = goodDoc();

    const code = await run(['render', doc], io.out, io.err);

    const expected = doc.replace(/\.md$/, '.html');
    expect(code).toBe(0);
    expect(existsSync(expected)).toBe(true);
    expect(out.join('\n')).toContain(`file://${expected}`);
  });

  it('still honours an explicit output path', async () => {
    const { io } = capture();
    const output = join(mkdtempSync(join(tmpdir(), 'explorer-out-')), 'named.html');

    await run(['render', goodDoc(), '-o', output], io.out, io.err);

    expect(existsSync(output)).toBe(true);
  });

  it('says so when asked for a render-time style, rather than ignoring the flag', async () => {
    const { io, err } = capture();

    const code = await run(['render', goodDoc(), '--style', 'terminal'], io.out, io.err);

    // Silently accepting a flag that no longer does anything is worse than
    // failing: the reader would get a surface nobody chose.
    expect(code).toBe(2);
    expect(err.join('\n')).toMatch(/no longer chosen at render time/i);
    expect(err.join('\n')).toMatch(/terminal/);
  });

  it('reports a version, so a beta report names a build', async () => {
    const { io, out } = capture();

    const code = await run(['--version'], io.out, io.err);

    expect(code).toBe(0);
    expect(out.join('\n')).toMatch(/^explorer \d+\.\d+\.\d+/);
  });

  it('points the editor link wherever the reader keeps their editor', async () => {
    const { io } = capture();
    const output = join(mkdtempSync(join(tmpdir(), 'explorer-editor-')), 'a.html');

    await run(
      ['render', goodDoc(), '-o', output, '--editor', 'zed://file{path}:{line}'],
      io.out,
      io.err,
    );

    const html = readFileSync(output, 'utf8');
    expect(html).toContain('zed://file');
    expect(html).not.toContain('vscode://');
  });
});

describe('the rendered artifact is reachable', () => {
  it('turns a relative output path into an absolute file URL', () => {
    expect(fileUrl('out/doc.html')).toBe(`file://${join(process.cwd(), 'out/doc.html')}`);
  });

  it('percent-encodes a space so the whole URL stays clickable', () => {
    expect(fileUrl('/tmp/my docs/a.html')).toBe('file:///tmp/my%20docs/a.html');
  });

  it('picks the platform opener', () => {
    expect(openCommand('darwin')).toBe('open');
    expect(openCommand('win32')).toBe('start');
    expect(openCommand('linux')).toBe('xdg-open');
  });

  it('prints a file URL, not the bare path, so a terminal can open it', async () => {
    const { io, out } = capture();
    const output = join(mkdtempSync(join(tmpdir(), 'explorer-out-')), 'doc.html');

    const code = await run(['render', goodDoc(), '-o', output], io.out, io.err);

    expect(code).toBe(0);
    expect(out.join('\n')).toContain(`file://${output}`);
  });

  it('launches the opener with the artifact when --open is given', async () => {
    const { io } = capture();
    const output = join(mkdtempSync(join(tmpdir(), 'explorer-out-')), 'doc.html');
    const launched: string[] = [];

    const code = await run(['render', goodDoc(), '-o', output, '--open'], io.out, io.err, path =>
      launched.push(path),
    );

    expect(code).toBe(0);
    expect(launched).toEqual([output]);
  });

  it('does not launch anything without --open', async () => {
    const { io } = capture();
    const output = join(mkdtempSync(join(tmpdir(), 'explorer-out-')), 'doc.html');
    const launched: string[] = [];

    await run(['render', goodDoc(), '-o', output], io.out, io.err, path => launched.push(path));

    expect(launched).toEqual([]);
  });

  it('never launches an artifact it refused to write', async () => {
    const repo = makeRepo({ 'src/x.ts': numberedLines(10) });
    const doc = writeDoc(`---
title: Broken
sources:
  - id: web
    path: ${repo.path}
    head: main
---
:::cite src/x.ts:50-60
:::
`);
    const { io } = capture();
    const launched: string[] = [];

    const code = await run(
      ['render', doc, '-o', join(tmpdir(), 'never.html'), '--open'],
      io.out,
      io.err,
      path => launched.push(path),
    );

    expect(code).toBe(1);
    expect(launched).toEqual([]);
  });
});

describe('explorer check', () => {
  it('exits 0 and reports the count when every citation resolves', async () => {
    const { io, out } = capture();

    const code = await run(['check', goodDoc()], io.out, io.err);

    expect(code).toBe(0);
    expect(out.join('\n')).toMatch(/1 citation and 0 file references resolved/);
  });

  it('exits 1 and prints one compact line per failure', async () => {
    const repo = makeRepo({ 'src/x.ts': numberedLines(41) });
    const doc = writeDoc(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
:::cite src/x.ts:55-60
:::

:::cite src/gone.ts:1-1
:::
`);
    const { io, err } = capture();

    const code = await run(['check', doc], io.out, io.err);

    expect(code).toBe(1);
    expect(err).toContain('web src/x.ts has 41 lines, cited 55-60');
    expect(err.some(line => line.includes('src/gone.ts'))).toBe(true);
  });

  it('exits 1 with the parse error when the document itself is malformed', async () => {
    const doc = writeDoc('no front matter here\n');
    const { io, err } = capture();

    const code = await run(['check', doc], io.out, io.err);

    expect(code).toBe(1);
    expect(err.join('\n')).toMatch(/front matter/i);
  });

  it('exits 1 when the document does not exist', async () => {
    const { io, err } = capture();

    const code = await run(['check', '/no/such/doc.md'], io.out, io.err);

    expect(code).toBe(1);
    expect(err.join('\n')).toContain('/no/such/doc.md');
  });
});

describe('explorer render', () => {
  it('writes a self-contained artifact and exits 0', async () => {
    const doc = goodDoc();
    const out = join(mkdtempSync(join(tmpdir(), 'explorer-out-')), 'artifact.html');
    const { io } = capture();

    const code = await run(['render', doc, '-o', out], io.out, io.err);

    expect(code).toBe(0);
    expect(readFileSync(out, 'utf8')).toContain('<figure class="cite"');
  });

  it('refuses to write anything when a citation fails', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(3) });
    const doc = writeDoc(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
:::cite src/a.ts:99-99
:::
`);
    const out = join(mkdtempSync(join(tmpdir(), 'explorer-out-')), 'artifact.html');
    const { io, err } = capture();

    const code = await run(['render', doc, '-o', out], io.out, io.err);

    expect(code).toBe(1);
    expect(existsSync(out)).toBe(false);
    expect(err.some(line => line.includes('99-99'))).toBe(true);
  });

  it('exits 2 when -o is given without a path', async () => {
    const { io, err } = capture();

    const code = await run(['render', goodDoc(), '-o'], io.out, io.err);

    expect(code).toBe(2);
    expect(err.join('\n')).toMatch(/-o/);
  });
});

describe('explorer usage', () => {
  it('exits 2 with usage when given no command', async () => {
    const { io, err } = capture();
    expect(await run([], io.out, io.err)).toBe(2);
    expect(err.join('\n')).toMatch(/usage/i);
  });

  it('exits 2 on an unknown command', async () => {
    const { io, err } = capture();
    expect(await run(['frobnicate'], io.out, io.err)).toBe(2);
    expect(err.join('\n')).toContain('frobnicate');
  });

  it('exits 0 for --help and names both commands', async () => {
    const { io, out } = capture();
    expect(await run(['--help'], io.out, io.err)).toBe(0);
    expect(out.join('\n')).toContain('render');
    expect(out.join('\n')).toContain('check');
  });
});

describe('the executable itself', () => {
  it('propagates the failure exit code to the shell', async () => {
    const doc = writeDoc('not a document\n');

    await expect(
      execFileAsync(process.execPath, ['--experimental-strip-types', 'src/cli.ts', 'check', doc], {
        cwd: new URL('..', import.meta.url).pathname,
      }),
    ).rejects.toMatchObject({ code: 1 });
  });
});

describe('the four ways a citation can fail', () => {
  it('gives each one a distinct, actionable message and a non-zero exit', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(41) });
    const cases = [
      { name: 'range past EOF', head: 'main', body: ':::cite web src/a.ts:55-60\n:::' },
      { name: 'missing file', head: 'main', body: ':::cite web src/gone.ts:1-1\n:::' },
      { name: 'unknown source id', head: 'main', body: ':::cite nope src/a.ts:1-1\n:::' },
      { name: 'ref not present', head: 'no-such-ref', body: ':::cite web src/a.ts:1-1\n:::' },
    ];

    const messages: string[] = [];
    for (const testCase of cases) {
      const doc = writeDoc(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: ${testCase.head}
  - id: other
    path: ${repo.path}
    head: main
---
${testCase.body}
`);
      const { io, err } = capture();
      const code = await run(['check', doc], io.out, io.err);

      expect(code, testCase.name).toBe(1);
      expect(err.length, testCase.name).toBeGreaterThan(0);
      messages.push(err.join(' '));
    }

    expect(new Set(messages).size).toBe(cases.length);
    expect(messages[0]).toContain('41 lines, cited 55-60');
    expect(messages[1]).toContain('src/gone.ts');
    expect(messages[2]).toContain("unknown source 'nope'");
    expect(messages[3]).toContain('no-such-ref');
  });

  it('renders a prose-led navigator document through the gated CLI', async () => {
    const repo = makeRepo({ 'src/architecture.ts': numberedLines(12) });
    const prose = writeDoc(`---
title: Navigator orientation
sources:
  - id: web
    repo: acme/web
    path: ${repo.path}
    head: main
---

## The map

The reader starts with responsibilities, interactions, and the unknown boundary.

## One behavior

The narrative follows one behavior back to the wider architecture.
`);
    const proseOut = join(mkdtempSync(join(tmpdir(), 'explorer-navigator-')), 'prose.html');
    const proseIo = capture();

    expect(await run(['render', prose, '-o', proseOut], proseIo.io.out, proseIo.io.err)).toBe(0);
    const proseHtml = readFileSync(proseOut, 'utf8');
    expect(proseHtml).toContain('The reader starts with responsibilities');
    expect(proseHtml).toContain(`class="pin-sha">${repo.sha}`);
    expect(proseHtml).not.toContain('<figure class="cite"');

    const selective = writeDoc(`---
title: Navigator with evidence
sources:
  - id: web
    repo: acme/web
    path: ${repo.path}
    head: main
---

## The map

The narrative leads with the system shape before selective evidence.

:::cite web src/architecture.ts:3-5
The citation anchors one decision without turning the document into a code dump.
:::
`);
    const selectiveOut = join(mkdtempSync(join(tmpdir(), 'explorer-navigator-')), 'selective.html');
    const selectiveIo = capture();

    expect(await run(['render', selective, '-o', selectiveOut], selectiveIo.io.out, selectiveIo.io.err)).toBe(0);
    expect(readFileSync(selectiveOut, 'utf8')).toContain('<figure class="cite"');

    const invalidSource = writeDoc(`---
title: Invalid source
sources:
  - id: web
    path: ${repo.path}
    head: main
---
:::cite nope src/architecture.ts:1-2
:::
`);
    const invalidOut = join(mkdtempSync(join(tmpdir(), 'explorer-navigator-')), 'invalid.html');
    const invalidIo = capture();
    expect(await run(['render', invalidSource, '-o', invalidOut], invalidIo.io.out, invalidIo.io.err)).toBe(1);
    expect(invalidIo.err.join('\\n')).toContain("unknown source 'nope'");
    expect(existsSync(invalidOut)).toBe(false);

    const unresolved = writeDoc(`---
title: Resolution failure
sources:
  - id: web
    path: ${repo.path}
    head: main
---
:::cite web src/missing.ts:1-2
:::
`);
    const unresolvedOut = join(mkdtempSync(join(tmpdir(), 'explorer-navigator-')), 'unresolved.html');
    const unresolvedIo = capture();
    expect(await run(['render', unresolved, '-o', unresolvedOut], unresolvedIo.io.out, unresolvedIo.io.err)).toBe(1);
    expect(unresolvedIo.err.some(line => line.includes('src/missing.ts'))).toBe(true);
    expect(existsSync(unresolvedOut)).toBe(false);

    const stale = repo.sha;
    writeFileSync(`${repo.path}/src/architecture.ts`, numberedLines(14));
    execFileSync('git', ['-C', repo.path, 'commit', '--quiet', '-am', 'moved heading']);
    const moved = writeDoc(`---
title: Moved source
sources:
  - id: web
    path: ${repo.path}
    head: main
    sha: ${stale}
---
## The map

The pinned source moved and must gate output.
`);
    const movedOut = join(mkdtempSync(join(tmpdir(), 'explorer-navigator-')), 'moved.html');
    const movedIo = capture();
    expect(await run(['render', moved, '-o', movedOut], movedIo.io.out, movedIo.io.err)).toBe(1);
    expect(movedIo.err.join('\\n')).toContain('was pinned to');
    expect(existsSync(movedOut)).toBe(false);
  });
});

describe('explorer pin', () => {
  it('writes the resolved sha into the front matter', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(10) });
    const path = writeDoc(`---
title: Fixture
sources:
  - id: web
    path: ${repo.path}
    head: main
---
:::cite src/a.ts:1-2
:::
`);
    const { io, out } = capture();

    const code = await run(['pin', path], io.out, io.err);

    expect(code).toBe(0);
    expect(readFileSync(path, 'utf8')).toContain(`sha: ${repo.sha}`);
    expect(out.join('\n')).toContain('web');
  });

  it('updates a stale sha and says what moved', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(10) });
    const stale = repo.sha;
    writeFileSync(`${repo.path}/src/a.ts`, numberedLines(30));
    execFileSync('git', ['-C', repo.path, 'commit', '--quiet', '-am', 'moved']);
    const moved = execFileSync('git', ['-C', repo.path, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();

    const path = writeDoc(`---
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
    const { io, out } = capture();

    expect(await run(['pin', path], io.out, io.err)).toBe(0);

    const after = readFileSync(path, 'utf8');
    expect(after).toContain(`sha: ${moved}`);
    expect(after).not.toContain(stale);
    expect(out.join('\n')).toContain(stale.slice(0, 10));
  });

  it('refuses to render a document whose branch has moved', async () => {
    const repo = makeRepo({ 'src/a.ts': numberedLines(10) });
    const stale = repo.sha;
    writeFileSync(`${repo.path}/src/a.ts`, numberedLines(30));
    execFileSync('git', ['-C', repo.path, 'commit', '--quiet', '-am', 'moved']);

    const path = writeDoc(`---
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
    const out = join(mkdtempSync(join(tmpdir(), 'explorer-moved-')), 'a.html');
    const { io, err } = capture();

    expect(await run(['render', path, '-o', out], io.out, io.err)).toBe(1);
    expect(existsSync(out)).toBe(false);
    expect(err.join('\n')).toContain('explorer pin');
  });
});
