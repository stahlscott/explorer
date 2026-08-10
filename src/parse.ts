import { parse as parseYaml } from 'yaml';

export interface Source {
  id: string;
  repo: string | null;
  path: string;
  base: string | null;
  head: string;
}

export interface Citation {
  kind: 'cite';
  sourceId: string;
  path: string;
  start: number;
  end: number;
  caption: string | null;
}

export interface Prose {
  kind: 'prose';
  markdown: string;
}

export type Block = Prose | Citation;

export interface Doc {
  frontMatter: Record<string, unknown>;
  title: string | null;
  sources: Source[];
  blocks: Block[];
}

export class DocumentError extends Error {}

const FRONT_MATTER_FENCE = /^---[ \t]*$/;
const CODE_FENCE = /^\s*(```+|~~~+)/;
const CITE_OPEN = /^:::cite[ \t]+(.*)$/;
const CITE_CLOSE = /^:::[ \t]*$/;

/**
 * `<source-id>? <path>:<start>(-<end>)?`. The id is optional only because a
 * single-source document may omit it; the caller resolves that.
 */
const CITE_TARGET = /^(?:(\S+)[ \t]+)?(\S+?):(\d+)(?:-(\d+))?$/;

function splitFrontMatter(text: string): { yaml: string; body: string; bodyOffset: number } {
  const lines = text.split('\n');
  if (lines[0] === undefined || !FRONT_MATTER_FENCE.test(lines[0])) {
    throw new DocumentError('document has no front matter: expected a line of --- as line 1');
  }

  const close = lines.findIndex((line, i) => i > 0 && FRONT_MATTER_FENCE.test(line));
  if (close === -1) {
    throw new DocumentError('front matter is never closed: expected a second line of ---');
  }

  return {
    yaml: lines.slice(1, close).join('\n'),
    body: lines.slice(close + 1).join('\n'),
    bodyOffset: close + 2,
  };
}

function readSources(frontMatter: Record<string, unknown>): Source[] {
  const raw = frontMatter.sources;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new DocumentError('front matter declares no sources: add a sources: list');
  }

  return raw.map((entry, i) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new DocumentError(`source ${i} is not a mapping`);
    }
    const source = entry as Record<string, unknown>;
    for (const required of ['id', 'path', 'head'] as const) {
      if (typeof source[required] !== 'string') {
        throw new DocumentError(`source ${i} is missing a ${required}`);
      }
    }
    return {
      id: source.id as string,
      repo: typeof source.repo === 'string' ? source.repo : null,
      path: source.path as string,
      base: typeof source.base === 'string' ? source.base : null,
      head: source.head as string,
    };
  });
}

function parseCiteTarget(
  target: string,
  sources: Source[],
  line: number,
): Omit<Citation, 'kind' | 'caption'> {
  const trimmed = target.trim();
  const match = trimmed.match(CITE_TARGET);
  if (!match) {
    if (!/:\d/.test(trimmed)) {
      throw new DocumentError(
        `line ${line}: citation has no line range: expected ':::cite <source> <path>:<start>-<end>'`,
      );
    }
    throw new DocumentError(`line ${line}: could not read citation target '${trimmed}'`);
  }

  const [, explicitId, path, startText, endText] = match;
  const start = Number(startText);
  const end = endText === undefined ? start : Number(endText);

  if (end < start) {
    throw new DocumentError(`line ${line}: citation range runs backwards: ${start}-${end}`);
  }
  if (start < 1) {
    throw new DocumentError(`line ${line}: citation starts at line ${start}; lines are 1-indexed`);
  }

  let sourceId = explicitId;
  if (sourceId === undefined) {
    if (sources.length !== 1) {
      throw new DocumentError(
        `line ${line}: citation omits its source id, but the document declares ${sources.length} sources`,
      );
    }
    sourceId = sources[0]!.id;
  }

  return { sourceId, path: path!, start, end };
}

export function parseDocument(text: string): Doc {
  const { yaml, body, bodyOffset } = splitFrontMatter(text);
  const frontMatter = (parseYaml(yaml) ?? {}) as Record<string, unknown>;
  const sources = readSources(frontMatter);

  const blocks: Block[] = [];
  const lines = body.split('\n');
  let prose: string[] = [];
  let fence: string | null = null;

  const flushProse = () => {
    if (prose.some(line => line.trim() !== '')) {
      blocks.push({ kind: 'prose', markdown: prose.join('\n') });
    }
    prose = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    // A cite directive inside a fenced block is documentation, not a citation.
    const fenceMatch = line.match(CODE_FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence === null) {
        fence = marker.slice(0, 3);
      } else if (marker.startsWith(fence)) {
        fence = null;
      }
      prose.push(line);
      continue;
    }
    if (fence !== null) {
      prose.push(line);
      continue;
    }

    const open = line.match(CITE_OPEN);
    if (!open) {
      prose.push(line);
      continue;
    }

    const target = parseCiteTarget(open[1]!, sources, bodyOffset + i);
    const caption: string[] = [];
    let closed = false;
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      if (CITE_CLOSE.test(lines[j]!)) {
        closed = true;
        break;
      }
      caption.push(lines[j]!);
    }
    if (!closed) {
      throw new DocumentError(`line ${bodyOffset + i}: citation has no closing ':::'`);
    }

    flushProse();
    const captionText = caption.join('\n').trim();
    blocks.push({ kind: 'cite', ...target, caption: captionText === '' ? null : captionText });
    i = j;
  }

  flushProse();

  return {
    frontMatter,
    title: typeof frontMatter.title === 'string' ? frontMatter.title : null,
    sources,
    blocks,
  };
}
