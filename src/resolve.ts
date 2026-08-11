import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { isAbsolute, resolve as resolvePath } from 'node:path';
import type { Citation, Doc, Source } from './parse.ts';

export interface ResolvedSource extends Source {
  /** Absolute, with any leading ~ expanded. */
  directory: string;
  /** The head ref pinned to a concrete commit. Every blob is read at this sha. */
  sha: string;
  /**
   * A checkout whose working tree is at `sha`, or null when none is. Null means
   * no editor link: the files an editor would open are a different commit's, and
   * a cited path may not exist on disk at all.
   */
  checkout: string | null;
}

export interface ResolvedCitation {
  citation: Citation;
  source: ResolvedSource;
  lines: string[];
  before: string[];
  after: string[];
  totalLines: number;
  /**
   * Every line of the file at the pinned sha. The renderer highlights the whole
   * file and slices, because a grammar started mid-file mis-reads any excerpt
   * that opens on a closing delimiter.
   */
  fileLines: string[];
}

export type FailureCode =
  | 'unknown-source'
  | 'repo-not-found'
  | 'ref-not-found'
  | 'missing-file'
  | 'range-past-eof'
  | 'missing-reference'
  | 'ambiguous-reference'
  | 'moved-head';

/**
 * A file named in prose as `<source-id> <path>`, resolved to a real path at the
 * pinned sha. The renderer links these, so a file list in a document carries
 * the same guarantee a citation does: the tool built the link, not the author.
 */
export interface ResolvedReference {
  text: string;
  source: ResolvedSource;
  path: string;
}

export interface CitationFailure {
  code: FailureCode;
  /** One compact line, actionable on its own. */
  message: string;
}

export interface Resolution {
  sources: ResolvedSource[];
  citations: ResolvedCitation[];
  /** Keyed by the code span exactly as authored. */
  references: Map<string, ResolvedReference>;
  failures: CitationFailure[];
}

export interface ResolveOptions {
  contextLines?: number;
}

const DEFAULT_CONTEXT_LINES = 12;

function expandHome(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return resolvePath(homedir(), path.slice(2));
  return isAbsolute(path) ? path : resolvePath(path);
}

function git(directory: string, args: string[]): string {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * Split a blob the way an editor numbers it: a trailing newline terminates the
 * last line rather than starting an empty one.
 */
function toLines(blob: string): string[] {
  const lines = blob.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * The working tree sitting at `sha`, checking linked worktrees as well as the
 * main one. A stacked branch is usually checked out in a worktree rather than
 * the directory the document names, and only a tree at the pinned commit holds
 * the bytes the artifact shows.
 */
function findCheckout(directory: string, sha: string): string | null {
  let listing: string;
  try {
    listing = git(directory, ['worktree', 'list', '--porcelain']);
  } catch {
    return null;
  }

  // Decided per block rather than on the HEAD line, because `prunable` is
  // reported after it: a worktree whose directory has been deleted still lists
  // its old HEAD, and returning early linked an editor at a path that is gone.
  let path: string | null = null;
  let head: string | null = null;
  let prunable = false;

  const blocks = [...listing.split('\n'), ''];
  for (const line of blocks) {
    if (line.startsWith('worktree ')) path = line.slice('worktree '.length);
    else if (line.startsWith('HEAD ')) head = line.slice('HEAD '.length).trim();
    else if (line.startsWith('prunable')) prunable = true;
    else if (line.trim() === '') {
      if (path !== null && head === sha && !prunable) return path;
      path = null;
      head = null;
      prunable = false;
    }
  }
  return null;
}

/** Inline code spans, skipping fenced regions where they are illustrations. */
function proseCodeSpans(markdown: string): string[] {
  const spans: string[] = [];
  let fence: string | null = null;

  for (const line of markdown.split('\n')) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence === null) fence = marker.slice(0, 3);
      else if (marker.startsWith(fence)) fence = null;
      continue;
    }
    if (fence !== null) continue;

    for (const match of line.matchAll(/`([^`\n]+)`/g)) spans.push(match[1]!);
  }

  return spans;
}

function pinSource(source: Source): ResolvedSource | CitationFailure {
  const directory = expandHome(source.path);

  try {
    git(directory, ['rev-parse', '--git-dir']);
  } catch {
    return {
      code: 'repo-not-found',
      message: `${source.id} ${directory} is not a git repository`,
    };
  }

  try {
    const head = git(directory, ['rev-parse', '--verify', `${source.head}^{commit}`]).trim();

    // A recorded sha wins, and a branch that has moved off it is a failure
    // rather than a silent re-point: the prose was written against the old tree.
    if (source.sha && source.sha !== head) {
      return {
        code: 'moved-head',
        message:
          `${source.id} was pinned to ${source.sha.slice(0, 10)} but ${source.head} is now ` +
          `${head.slice(0, 10)}; re-read the citations, then repin with 'explorer pin'`,
      };
    }

    const sha = source.sha ?? head;
    return { ...source, directory, sha, checkout: findCheckout(directory, sha) };
  } catch {
    return {
      code: 'ref-not-found',
      message: `${source.id} has no ref '${source.head}' locally; fetch it or pin a different head`,
    };
  }
}

export function resolveDocument(doc: Doc, options: ResolveOptions = {}): Resolution {
  const contextLines = options.contextLines ?? DEFAULT_CONTEXT_LINES;

  const sources: ResolvedSource[] = [];
  const failures: CitationFailure[] = [];
  const byId = new Map<string, ResolvedSource>();

  for (const source of doc.sources) {
    const pinned = pinSource(source);
    if ('code' in pinned) {
      failures.push(pinned);
      continue;
    }
    sources.push(pinned);
    byId.set(pinned.id, pinned);
  }

  const blobs = new Map<string, string[]>();
  const citations: ResolvedCitation[] = [];

  for (const block of doc.blocks) {
    if (block.kind !== 'cite') continue;

    const source = byId.get(block.sourceId);
    if (!source) {
      // A source that failed to pin already reported itself; do not report twice.
      if (doc.sources.some(s => s.id === block.sourceId)) continue;
      failures.push({
        code: 'unknown-source',
        message: `unknown source '${block.sourceId}' in ${block.path}; declared sources are ${doc.sources
          .map(s => s.id)
          .join(', ')}`,
      });
      continue;
    }

    const key = `${source.sha}:${block.path}`;
    let lines = blobs.get(key);
    if (!lines) {
      try {
        lines = toLines(git(source.directory, ['show', `${source.sha}:${block.path}`]));
      } catch {
        failures.push({
          code: 'missing-file',
          message: `${source.id} ${block.path} is not present at ${source.head} (${source.sha.slice(0, 10)})`,
        });
        continue;
      }
      blobs.set(key, lines);
    }

    if (block.end > lines.length) {
      failures.push({
        code: 'range-past-eof',
        message: `${source.id} ${block.path} has ${lines.length} lines, cited ${block.start}-${block.end}`,
      });
      continue;
    }

    citations.push({
      citation: block,
      source,
      lines: lines.slice(block.start - 1, block.end),
      before: lines.slice(Math.max(0, block.start - 1 - contextLines), block.start - 1),
      after: lines.slice(block.end, Math.min(lines.length, block.end + contextLines)),
      totalLines: lines.length,
      fileLines: lines,
    });
  }

  const references = resolveReferences(doc, byId, failures);

  return { sources, citations, references, failures };
}

/**
 * A path may be abbreviated, since a full path is often unreadable in a table.
 * The fragment must match exactly one file at the pinned sha; anything else is
 * a failure, because a file list nobody checked is the prose this tool exists
 * to replace.
 */
function resolveReferences(
  doc: Doc,
  byId: Map<string, ResolvedSource>,
  failures: CitationFailure[],
): Map<string, ResolvedReference> {
  const references = new Map<string, ResolvedReference>();
  if (byId.size === 0) return references;

  const trees = new Map<string, string[]>();
  const treeOf = (source: ResolvedSource): string[] => {
    let tree = trees.get(source.sha);
    if (!tree) {
      try {
        tree = git(source.directory, ['ls-tree', '-r', '--name-only', source.sha])
          .split('\n')
          .filter(Boolean);
      } catch {
        tree = [];
      }
      trees.set(source.sha, tree);
    }
    return tree;
  };

  const seen = new Set<string>();
  for (const block of doc.blocks) {
    if (block.kind !== 'prose') continue;

    for (const span of proseCodeSpans(block.markdown)) {
      if (seen.has(span)) continue;

      const named = span.match(/^(\S+)[ \t]+(\S+)$/);
      // A bare path is only unambiguous with one source, and it is prose rather
      // than a claim, so it links when it resolves and is left alone when it
      // does not. Requiring a slash keeps symbols like `ProviderGoals.model`
      // out of it.
      const bare =
        !named && byId.size === 1 && /\//.test(span) && !/\s/.test(span) ? span : null;

      const source = named ? byId.get(named[1]!) : [...byId.values()][0];
      if (!source) continue;
      if (!named && !bare) continue;
      seen.add(span);

      const explicit = named !== null;
      const fragment = named ? named[2]! : bare!;
      const tree = treeOf(source);
      const hits = tree.filter(
        path => path === fragment || path.endsWith(`/${fragment}`),
      );

      if (hits.length === 1) {
        references.set(span, { text: span, source, path: hits[0]! });
      } else if (!explicit) {
        continue;
      } else if (hits.length === 0) {
        failures.push({
          code: 'missing-reference',
          message: `${source.id} ${fragment} matches no file at ${source.head}`,
        });
      } else {
        failures.push({
          code: 'ambiguous-reference',
          message: `${source.id} ${fragment} matches ${hits.length} files at ${source.head}; name more of the path`,
        });
      }
    }
  }

  return references;
}
