import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface TempRepo {
  path: string;
  sha: string;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/**
 * A real git repository with real commits. The resolver reads blobs with
 * `git show`, so a fake would test the fake.
 */
export function makeRepo(files: Record<string, string>, branch = 'main'): TempRepo {
  const path = mkdtempSync(join(tmpdir(), 'explorer2-'));

  git(path, 'init', '--quiet', '--initial-branch', branch);
  git(path, 'config', 'user.email', 'test@example.com');
  git(path, 'config', 'user.name', 'Test');

  for (const [name, content] of Object.entries(files)) {
    const full = join(path, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  git(path, 'add', '--all');
  git(path, 'commit', '--quiet', '-m', 'fixture');

  return { path, sha: git(path, 'rev-parse', 'HEAD') };
}

export function numberedLines(count: number): string {
  return `${Array.from({ length: count }, (_, i) => `line ${i + 1}`).join('\n')}\n`;
}
