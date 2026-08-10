import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { isAbsolute, resolve as resolvePath } from 'node:path';
import type { Citation, Doc, Source } from './parse.ts';

export interface ResolvedSource extends Source {
  /** Absolute, with any leading ~ expanded. */
  directory: string;
  /** The head ref pinned to a concrete commit. Every blob is read at this sha. */
  sha: string;
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
  | 'range-past-eof';

export interface CitationFailure {
  code: FailureCode;
  /** One compact line, actionable on its own. */
  message: string;
}

export interface Resolution {
  sources: ResolvedSource[];
  citations: ResolvedCitation[];
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
    const sha = git(directory, ['rev-parse', '--verify', `${source.head}^{commit}`]).trim();
    return { ...source, directory, sha };
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

  return { sources, citations, failures };
}
