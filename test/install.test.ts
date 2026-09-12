import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = resolve(process.cwd());
const INSTALLER = join(REPO, 'scripts/install.sh');

type Fixture = {
  root: string;
  home: string;
  bin: string;
  shared: string;
  harness: string;
};

type Run = { status: number; stdout: string; stderr: string };

function fixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'explorer-install-'));
  const home = join(root, 'home');
  const bin = join(root, 'bin');
  const shared = join(root, 'shared');
  const harness = join(root, 'harness');
  mkdirSync(home);
  mkdirSync(bin);
  mkdirSync(shared);
  mkdirSync(harness);
  return { root, home, bin, shared, harness };
}

function runInstall(
  f: Fixture,
  options: { harnessDir?: string; harnessDirs?: string; bin?: string; shared?: string } = {},
): Run {
  const env = { ...process.env } as Record<string, string>;
  env.HOME = f.home;
  env.BIN_DIR = options.bin ?? f.bin;
  env.SHARED_SKILLS = options.shared ?? f.shared;
  delete env.HARNESS_DIR;
  delete env.HARNESS_DIRS;
  if (options.harnessDirs !== undefined) {
    env.HARNESS_DIRS = options.harnessDirs;
  } else {
    env.HARNESS_DIR = options.harnessDir ?? f.harness;
  }
  try {
    const result = execFileSync('bash', [INSTALLER], {
      cwd: REPO,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout: result, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      status: failure.status ?? 1,
      stdout: String(failure.stdout ?? ''),
      stderr: String(failure.stderr ?? ''),
    };
  }
}

function typeOf(mode: number): string {
  if ((mode & 0o170000) === 0o040000) return 'directory';
  if ((mode & 0o170000) === 0o120000) return 'symlink';
  if ((mode & 0o170000) === 0o100000) return 'file';
  return 'other';
}

function snapshotOne(path: string, label: string, output: Record<string, unknown>): void {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    output[label] = { type: 'missing' };
    return;
  }
  const entry: Record<string, unknown> = {
    type: typeOf(stat.mode),
    mode: stat.mode & 0o7777,
  };
  if (entry.type === 'symlink') {
    entry.target = readlinkSync(path);
  } else if (entry.type === 'file') {
    entry.bytes = readFileSync(path).toString('base64');
  } else if (entry.type === 'directory') {
    const children: Record<string, unknown> = {};
    for (const child of readdirSync(path)) {
      snapshotOne(join(path, child), `${label}/${child}`, output);
      children[child] = true;
    }
    entry.children = Object.keys(children).sort();
  }
  output[label] = entry;
}

function snapshot(f: Fixture): string {
  const output: Record<string, unknown> = {};
  snapshotOne(f.bin, 'bin', output);
  snapshotOne(f.shared, 'shared', output);
  snapshotOne(f.harness, 'harness', output);
  return JSON.stringify(output, null, 2);
}

function expectedTarget(path: string): string {
  return realpathSync(path);
}

function seed(path: string, kind: 'file' | 'directory' | 'symlink', target?: string): void {
  if (kind === 'file') writeFileSync(path, 'foreign destination\n');
  if (kind === 'directory') mkdirSync(path);
  if (kind === 'symlink') symlinkSync(target ?? '/foreign/target', path);
}

describe('safe explorer installer', () => {
  it('installs both skills in isolated roots', () => {
    const f = fixture();
    const result = runInstall(f);

    expect(result.status).toBe(0);
    expect(readFileSync(join(f.bin, 'explorer'), 'utf8')).toContain(
      `node --experimental-strip-types "${REPO}/src/cli.ts"`,
    );
    expect(expectedTarget(join(f.shared, 'explorer'))).toBe(expectedTarget(join(REPO, 'skills/explorer')));
    expect(expectedTarget(join(f.shared, 'navigator'))).toBe(expectedTarget(join(REPO, 'skills/navigator')));
    expect(expectedTarget(join(f.harness, 'explorer'))).toBe(expectedTarget(join(f.shared, 'explorer')));
    expect(expectedTarget(join(f.harness, 'navigator'))).toBe(expectedTarget(join(f.shared, 'navigator')));
    expect(result.stdout).toContain('resolved skill');
  });

  it('reinstall preserves expected managed links', () => {
    const f = fixture();
    expect(runInstall(f).status).toBe(0);
    const before = snapshot(f);
    expect(runInstall(f).status).toBe(0);
    expect(snapshot(f)).toBe(before);
  });

  it('installed navigator resolves the shared format', () => {
    const f = fixture();
    expect(runInstall(f).status).toBe(0);
    const format = join(f.harness, 'navigator', '..', 'explorer', 'references', 'format.md');
    expect(readFileSync(format, 'utf8')).toContain('# Format reference');
  });

  it('skips absent harness directories', () => {
    const f = fixture();
    const absent = join(f.root, 'not-installed');
    const result = runInstall(f, { harnessDir: absent });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`skipped  ${absent} (not present)`);
    expect(() => lstatSync(absent)).toThrow();
  });

  it('supports a literal-space singular HARNESS_DIR path', () => {
    const f = fixture();
    const harness = join(f.root, 'harness with spaces');
    mkdirSync(harness);
    expect(runInstall(f, { harnessDir: harness }).status).toBe(0);
    expect(expectedTarget(join(harness, 'navigator'))).toBe(expectedTarget(join(f.shared, 'navigator')));
  });

  it('supports a valid legacy two-directory HARNESS_DIRS list', () => {
    const f = fixture();
    const first = join(f.root, 'legacy-one');
    const second = join(f.root, 'legacy-two');
    mkdirSync(first);
    mkdirSync(second);
    expect(runInstall(f, { harnessDirs: `${first} ${second}` }).status).toBe(0);
    for (const harness of [first, second]) {
      expect(expectedTarget(join(harness, 'explorer'))).toBe(expectedTarget(join(f.shared, 'explorer')));
      expect(expectedTarget(join(harness, 'navigator'))).toBe(expectedTarget(join(f.shared, 'navigator')));
    }
  });

  it('rejects an invalid legacy spaced path without writes', () => {
    const f = fixture();
    const spaced = join(f.root, 'legacy harness with spaces');
    const before = snapshot(f);
    const result = runInstall(f, { harnessDirs: spaced });

    expect(result.status).not.toBe(0);
    expect(result.stderr.trim()).toBe('invalid HARNESS_DIRS entry; use HARNESS_DIR for a literal path');
    expect(snapshot(f)).toBe(before);
    expect(() => lstatSync(join(f.root, 'legacy'))).toThrow();
    // Existing split directories are valid legacy entries, not distinguishable input errors.
  });

  it('rejects conflicting harness variables before any write', () => {
    const f = fixture();
    const env = { ...process.env } as Record<string, string>;
    env.HOME = f.home;
    env.BIN_DIR = f.bin;
    env.SHARED_SKILLS = f.shared;
    env.HARNESS_DIR = join(f.root, 'one');
    env.HARNESS_DIRS = join(f.root, 'two');
    const before = snapshot(f);
    let result: Run;
    try {
      execFileSync('bash', [INSTALLER], { cwd: REPO, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      result = { status: 0, stdout: '', stderr: '' };
    } catch (error) {
      const failure = error as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
      result = { status: failure.status ?? 1, stdout: String(failure.stdout ?? ''), stderr: String(failure.stderr ?? '') };
    }
    expect(result.status).not.toBe(0);
    expect(result.stderr.trim()).toBe('set only one of HARNESS_DIR or HARNESS_DIRS');
    expect(snapshot(f)).toBe(before);
  });

  const foreignRoles = [
    { name: 'wrapper', path: (f: Fixture) => join(f.bin, 'explorer'), kind: 'file' as const },
    { name: 'shared explorer', path: (f: Fixture) => join(f.shared, 'explorer'), kind: 'directory' as const },
    { name: 'shared navigator', path: (f: Fixture) => join(f.shared, 'navigator'), kind: 'symlink' as const },
    { name: 'harness explorer', path: (f: Fixture) => join(f.harness, 'explorer'), kind: 'symlink' as const },
    { name: 'harness navigator', path: (f: Fixture) => join(f.harness, 'navigator'), kind: 'file' as const },
  ];

  it.each(foreignRoles)('refuses foreign destinations before any mutation: $name', scenario => {
    const f = fixture();
    seed(scenario.path(f), scenario.kind);
    const before = snapshot(f);
    const result = runInstall(f);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/installer refused:/);
    expect(snapshot(f)).toBe(before);
  });

  it.each([
    { name: 'nested symlink ancestor', configure: (f: Fixture) => {
      const target = join(f.root, 'real-parent');
      const link = join(f.root, 'linked-parent');
      mkdirSync(target);
      symlinkSync(target, link);
      return { bin: join(link, 'nested', 'bin') };
    } },
    { name: 'non-directory ancestor', configure: (f: Fixture) => {
      const file = join(f.root, 'not-a-directory');
      writeFileSync(file, 'ancestor');
      return { bin: join(file, 'nested', 'bin') };
    } },
  ])('rejects $name before any mutation', scenario => {
    const f = fixture();
    const configured = scenario.configure(f);
    const before = snapshot(f);
    const result = runInstall(f, { bin: configured.bin });
    expect(result.status).not.toBe(0);
    expect(snapshot(f)).toBe(before);
  });

  it('canonicalizes existing roots and rejects a destination escaping through a symlink', () => {
    const f = fixture();
    const realBin = join(f.root, 'real-bin');
    const binAlias = join(f.root, 'bin-alias');
    mkdirSync(realBin);
    symlinkSync(realBin, binAlias);
    const result = runInstall(f, { bin: join(binAlias, 'nested', 'bin') });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/symlinked ancestor|destination roles|refused/);
    expect(() => lstatSync(join(realBin, 'nested'))).toThrow();
  });

  it('rejects overlapping destination roles before any mutation', () => {
    const f = fixture();
    const before = snapshot(f);
    const result = runInstall(f, { harnessDir: f.shared });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/destination roles overlap/);
    expect(snapshot(f)).toBe(before);
  });

  it('preserves every earlier destination and ancestor on a late collision', () => {
    const f = fixture();
    const harness = f.harness;
    const result = runInstall(f, { harnessDir: harness });
    expect(result.status).toBe(0);
    const before = snapshot(f);
    const foreign = join(harness, 'navigator');
    const originalTarget = readlinkSync(foreign);
    // Replace only the last role after a valid install; all earlier entries must remain exact.
    unlinkSync(foreign);
    seed(foreign, 'symlink', '/foreign/late-collision');
    const afterSeed = snapshot(f);
    const refused = runInstall(f, { harnessDir: harness });
    expect(refused.status).not.toBe(0);
    expect(snapshot(f)).toBe(afterSeed);
    expect(readlinkSync(foreign)).toBe('/foreign/late-collision');
    expect(realpathSync(join(harness, 'explorer'))).toBe(realpathSync(join(f.shared, 'explorer')));
    expect(realpathSync(join(f.shared, 'explorer'))).toBe(realpathSync(join(REPO, 'skills/explorer')));
    expect(before).not.toBe('');
    // Canonicalize the shared directory itself (macOS /var -> /private/var) but
    // not the final entry, which is itself a symlink the installer must not
    // resolve through: the harness link points at the shared entry, not the source.
    expect(originalTarget).toBe(join(realpathSync(f.shared), 'navigator'));
  });
});
