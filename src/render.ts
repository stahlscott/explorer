import { Marked } from 'marked';
import type { Highlighter } from 'shiki';
import type { Doc } from './parse.ts';
import type {
  Resolution,
  ResolvedCitation,
  ResolvedReference,
  ResolvedSource,
} from './resolve.ts';
import { bundledLanguage, getHighlighter, languageForPath, THEMES } from './highlight.ts';
import { PAGE_SCRIPT } from './assets.ts';
import { BASE_STYLE, SHIKI_THEME_SWITCH } from './styles/base.ts';
import { DEFAULT_SKIN, skinCss } from './styles/skins.ts';

export interface RenderOptions {
  /** Lines of context kept either side of a citation. Must match the resolver. */
  contextLines?: number;
  skin?: string;
  /** Section nav. On by default; the layout hides it when there is no room. */
  toc?: boolean;
  /**
   * Template for the editor link, with `{path}` and `{line}` substituted. A
   * template rather than a list of known editors, because every editor's scheme
   * differs and none of them are this tool's business.
   */
  editorUrl?: string;
}

export const DEFAULT_EDITOR_URL = 'vscode://file{path}:{line}';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function sourceLabel(source: ResolvedSource): string {
  return source.repo ?? source.directory;
}

function askPrompt(lines: string[]): string {
  return [...lines, '', 'Question: '].join('\n');
}

function citationAsk(resolved: ResolvedCitation): string {
  const { citation, source } = resolved;
  return askPrompt([
    `Repo: ${sourceLabel(source)}`,
    `Commit: ${source.sha}`,
    `File: ${citation.path}`,
    `Lines: ${citation.start}-${citation.end}`,
  ]);
}

function sectionAsk(title: string, sources: ResolvedSource[]): string {
  return askPrompt([
    `Section: ${title}`,
    ...sources.map(s => `Repo: ${sourceLabel(s)} at ${s.sha}`),
  ]);
}

/** A permalink, so it keeps showing what the artifact shows. */
function githubBlobUrl(resolved: ResolvedCitation): string | null {
  const { citation, source } = resolved;
  if (!source.repo) return null;
  const anchor =
    citation.start === citation.end
      ? `#L${citation.start}`
      : `#L${citation.start}-L${citation.end}`;
  return `https://github.com/${source.repo}/blob/${source.sha}/${citation.path}${anchor}`;
}

/**
 * Only offered when some checkout is at the pinned commit, so the file it opens
 * is the file the artifact shows. Without that check the link points into
 * whatever branch happens to be checked out, where the path may not exist.
 */
function editorUrl(resolved: ResolvedCitation, template: string): string | null {
  const { citation, source } = resolved;
  if (!source.checkout) return null;
  return template
    .replace('{path}', `${source.checkout}/${citation.path}`)
    .replace('{line}', String(citation.start));
}

/**
 * The whole file, highlighted once and split into one HTML fragment per line.
 *
 * Highlighting only the excerpt starts the grammar mid-file, so an excerpt whose
 * window opens on a closing delimiter — the `"""` that ends a docstring — reads
 * as an opening one and paints everything after it as a single token. Shiki
 * emits exactly one newline between line spans, which is what makes the split
 * safe.
 */
function highlightFile(
  resolved: ResolvedCitation,
  highlighter: Highlighter,
  cache: Map<string, string[]>,
): string[] {
  const key = `${resolved.source.sha}:${resolved.citation.path}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const html = highlighter.codeToHtml(resolved.fileLines.join('\n'), {
    lang: bundledLanguage(languageForPath(resolved.citation.path)),
    themes: THEMES,
    defaultColor: false,
    transformers: [
      {
        line(node, line) {
          node.properties['data-line'] = String(line);
        },
      },
    ],
  });

  const body = html.match(/<code[^>]*>([\s\S]*)<\/code>/)![1]!;
  const lines = body.split('\n');
  cache.set(key, lines);
  return lines;
}

function renderCitation(
  resolved: ResolvedCitation,
  highlighter: Highlighter,
  index: number,
  inlineMarkdown: (markdown: string) => string,
  cache: Map<string, string[]>,
  editorTemplate: string,
): string {
  const { citation, source, before, after } = resolved;
  const firstLine = citation.start - before.length;
  const lastLine = citation.end + after.length;

  const window = highlightFile(resolved, highlighter, cache)
    .slice(firstLine - 1, lastLine)
    .map((line, offset) => {
      const absolute = firstLine + offset;
      const isContext = absolute < citation.start || absolute > citation.end;
      return isContext ? line.replace('class="line"', 'class="line ctx"') : line;
    })
    .join('\n');

  const code = `<pre class="shiki"><code>${window}</code></pre>`;

  const blobUrl = githubBlobUrl(resolved);
  const openUrl = editorUrl(resolved, editorTemplate);
  const range =
    citation.start === citation.end
      ? `${citation.start}`
      : `${citation.start}–${citation.end}`;
  const hasContext = before.length > 0 || after.length > 0;

  const cut = citation.path.lastIndexOf('/');
  const directory = cut === -1 ? '' : citation.path.slice(0, cut + 1);
  const file = citation.path.slice(cut + 1);

  return [
    `<figure class="cite" id="cite-${index}">`,
    '<div class="cite-head">',
    // Path and range are one unit: a range that wraps away from its path says
    // nothing. The affordances are a second unit, and stay together.
    '<span class="cite-where">' +
      `<b>${escapeHtml(source.id)}</b> ` +
      `<span class="cite-dir">${escapeHtml(directory)}</span>` +
      // File name and range travel together; only the directory may wrap.
      `<span class="cite-tail"><span class="cite-file">${escapeHtml(file)}</span>` +
      `<span class="cite-lines">${range}</span></span>` +
      '</span>',
    '<span class="cite-acts">',
    hasContext
      ? '<button class="cite-more" type="button" aria-expanded="false">context</button>'
      : '',
    blobUrl
      ? `<a class="cite-link" href="${escapeHtml(blobUrl)}" title="GitHub, at this commit">github</a>`
      : '',
    openUrl
      ? `<a class="cite-link" href="${escapeHtml(openUrl)}" title="Open in your editor, at the pinned commit">editor</a>`
      : '',
    `<button class="ask" type="button" data-ask="${escapeHtml(citationAsk(resolved))}">ask</button>`,
    '</span>',
    '</div>',
    `<div class="cite-code">${code}</div>`,
    citation.caption ? `<figcaption>${inlineMarkdown(citation.caption)}</figcaption>` : '',
    '</figure>',
  ]
    .filter(Boolean)
    .join('');
}

export interface Section {
  id: string;
  depth: number;
  title: string;
}

/** Lowercase, words joined by hyphens, and suffixed when a title repeats. */
function slugify(title: string, taken: Map<string, number>): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
  const seen = (taken.get(base) ?? 0) + 1;
  taken.set(base, seen);
  return seen === 1 ? base : `${base}-${seen}`;
}

function referenceLink(reference: ResolvedReference): string {
  const { source, path, text } = reference;
  const href = source.repo
    ? `https://github.com/${source.repo}/blob/${source.sha}/${path}`
    : null;
  const title = `${path} at ${source.sha.slice(0, 10)}`;
  const label = `<code>${escapeHtml(text)}</code>`;

  // Without a repo there is nowhere to point, but the full path is still worth
  // showing — the author wrote an abbreviation.
  if (!href) return `<span class="file-ref" title="${escapeHtml(title)}">${label}</span>`;
  return `<a class="file-ref" href="${escapeHtml(href)}" title="${escapeHtml(title)}">${label}</a>`;
}

function makeMarkdown(
  highlighter: Highlighter,
  sources: ResolvedSource[],
  sections: Section[],
  references: Map<string, ResolvedReference>,
): Marked {
  const marked = new Marked({ gfm: true });
  const taken = new Map<string, number>();

  marked.use({
    renderer: {
      codespan({ text }) {
        // `text` is entity-encoded by marked; references never contain markup,
        // so a plain lookup on the raw span is enough.
        const reference = references.get(text);
        return reference ? referenceLink(reference) : `<code>${text}</code>`;
      },
      code({ text, lang }) {
        const highlighted = highlighter.codeToHtml(text, {
          lang: bundledLanguage(lang ?? 'text'),
          themes: THEMES,
          defaultColor: false,
        });
        // Deliberately not a <figure class="cite">: this code was written by
        // the author, not read out of a repository, and must not look alike.
        return `<div class="sketch"><span class="sketch-tag">not from the repo</span>${highlighted}</div>`;
      },
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const title = stripTags(inner);
        const id = slugify(title, taken);
        if (depth >= 2 && depth <= 3) sections.push({ id, depth, title });
        const ask = depth <= 3
          ? `<button class="ask" type="button" data-ask="${escapeHtml(
              sectionAsk(title, sources),
            )}">ask</button>`
          : '';
        return `<h${depth} id="${escapeHtml(id)}">${inner}${ask}</h${depth}>`;
      },
    },
  });

  return marked;
}

function renderHeader(doc: Doc, sources: ResolvedSource[]): string {
  const question = typeof doc.frontMatter.question === 'string' ? doc.frontMatter.question : null;

  const pins = sources
    .map(
      s =>
        `<li><span class="pin-id">${escapeHtml(s.id)}</span> <span class="pin-repo">${escapeHtml(
          sourceLabel(s),
        )}</span> <code class="pin-sha">${escapeHtml(s.sha)}</code>` +
        `${s.base ? ` <span class="pin-base">base ${escapeHtml(s.base)}</span>` : ''}` +
        `${
          s.repo
            ? s.prs
                .map(
                  pr =>
                    ` <a class="pin-pr" href="https://github.com/${escapeHtml(
                      s.repo!,
                    )}/pull/${pr}">#${pr}</a>`,
                )
                .join('')
            : ''
        }</li>`,
    )
    .join('');

  return [
    '<header>',
    doc.title ? `<h1>${escapeHtml(doc.title)}</h1>` : '',
    question ? `<p class="question">${escapeHtml(question.trim())}</p>` : '',
    `<ul class="pins">${pins}</ul>`,
    '</header>',
  ]
    .filter(Boolean)
    .join('');
}

function renderToc(sections: Section[]): string {
  if (sections.length === 0) return '';
  const items = sections
    .map(
      section =>
        `<li class="toc-${section.depth}"><a href="#${escapeHtml(section.id)}">${escapeHtml(
          section.title,
        )}</a></li>`,
    )
    .join('');
  return `<nav class="toc" aria-label="Sections"><ol>${items}</ol></nav>`;
}

export async function renderDocument(
  doc: Doc,
  resolution: Resolution,
  options: RenderOptions = {},
): Promise<string> {
  const highlighter = await getHighlighter();
  const sections: Section[] = [];
  const markdown = makeMarkdown(highlighter, resolution.sources, sections, resolution.references);

  const byCitation = new Map(resolution.citations.map(c => [c.citation, c]));
  const inlineMarkdown = (text: string) => markdown.parseInline(text) as string;
  const highlighted = new Map<string, string[]>();
  let citationIndex = 0;

  const body = doc.blocks
    .map(block => {
      if (block.kind === 'prose') return markdown.parse(block.markdown) as string;
      const resolved = byCitation.get(block);
      if (!resolved) return '';
      citationIndex += 1;
      return renderCitation(
        resolved,
        highlighter,
        citationIndex,
        inlineMarkdown,
        highlighted,
        options.editorUrl ?? DEFAULT_EDITOR_URL,
      );
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.title ?? 'explorer')}</title>
<style>${BASE_STYLE}${SHIKI_THEME_SWITCH}${skinCss(options.skin ?? DEFAULT_SKIN)}</style>
</head>
<body>
<button class="theme-toggle" type="button" aria-label="Switch between the light and dark theme">theme</button>
${options.toc === false ? '' : renderToc(sections)}
<main>
${renderHeader(doc, resolution.sources)}
${body}
</main>
<div class="toast" role="status" aria-live="polite" hidden>copied</div>
<script>${PAGE_SCRIPT}</script>
</body>
</html>
`;
}
