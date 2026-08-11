import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
  // Canonical, because git reports realpaths and macOS puts temp dirs behind a
  // symlink. A test comparing the two forms fails for the wrong reason.
  const path = realpathSync(mkdtempSync(join(tmpdir(), 'explorer-')));

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

/**
 * A commit on a branch that is left un-checked-out, so nothing on disk holds
 * its tree. This is the case where an editor link would open the wrong file or
 * no file at all.
 */
export function addUncheckedBranch(
  repo: TempRepo,
  branch: string,
  files: Record<string, string>,
): string {
  const current = git(repo.path, 'rev-parse', '--abbrev-ref', 'HEAD');
  git(repo.path, 'checkout', '--quiet', '-b', branch);
  for (const [name, content] of Object.entries(files)) {
    const full = join(repo.path, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  git(repo.path, 'add', '--all');
  git(repo.path, 'commit', '--quiet', '-m', branch);
  const sha = git(repo.path, 'rev-parse', 'HEAD');
  git(repo.path, 'checkout', '--quiet', current);
  return sha;
}

/** A linked worktree with `branch` checked out, as `git worktree add` makes. */
export function addWorktree(repo: TempRepo, branch: string): string {
  const path = realpathSync(mkdtempSync(join(tmpdir(), 'explorer-wt-')));
  rmSync(path, { recursive: true, force: true });
  git(repo.path, 'worktree', 'add', '--quiet', path, branch);
  return path;
}
