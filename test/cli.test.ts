import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { run } from '../src/cli.ts';
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
  const dir = mkdtempSync(join(tmpdir(), 'explorer2-doc-'));
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
    const out = join(mkdtempSync(join(tmpdir(), 'explorer2-out-')), 'artifact.html');
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
    const out = join(mkdtempSync(join(tmpdir(), 'explorer2-out-')), 'artifact.html');
    const { io, err } = capture();

    const code = await run(['render', doc, '-o', out], io.out, io.err);

    expect(code).toBe(1);
    expect(existsSync(out)).toBe(false);
    expect(err.some(line => line.includes('99-99'))).toBe(true);
  });

  it('exits 2 when -o is missing', async () => {
    const { io, err } = capture();

    const code = await run(['render', goodDoc()], io.out, io.err);

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
    const out = join(mkdtempSync(join(tmpdir(), 'explorer2-moved-')), 'a.html');
    const { io, err } = capture();

    expect(await run(['render', path, '-o', out], io.out, io.err)).toBe(1);
    expect(existsSync(out)).toBe(false);
    expect(err.join('\n')).toContain('explorer pin');
  });
});
