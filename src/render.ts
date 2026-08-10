import { Marked } from 'marked';
import type { Highlighter } from 'shiki';
import type { Doc } from './parse.ts';
import type { Resolution, ResolvedCitation, ResolvedSource } from './resolve.ts';
import { bundledLanguage, getHighlighter, languageForPath, THEMES } from './highlight.ts';
import { PAGE_SCRIPT, PAGE_STYLE } from './assets.ts';

export interface RenderOptions {
  /** Lines of context kept either side of a citation. Must match the resolver. */
  contextLines?: number;
}

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

function renderCitation(
  resolved: ResolvedCitation,
  highlighter: Highlighter,
  index: number,
  inlineMarkdown: (markdown: string) => string,
): string {
  const { citation, source, before, lines, after } = resolved;
  const firstLine = citation.start - before.length;
  const body = [...before, ...lines, ...after].join('\n');

  const code = highlighter.codeToHtml(body, {
    lang: bundledLanguage(languageForPath(citation.path)),
    themes: THEMES,
    defaultColor: false,
    transformers: [
      {
        line(node, relative) {
          const absolute = firstLine + relative - 1;
          node.properties['data-line'] = String(absolute);
          if (absolute < citation.start || absolute > citation.end) {
            node.properties.class = `${node.properties.class ?? ''} ctx`.trim();
          }
        },
      },
    ],
  });

  const range =
    citation.start === citation.end
      ? `${citation.start}`
      : `${citation.start}–${citation.end}`;
  const hasContext = before.length > 0 || after.length > 0;

  return [
    `<figure class="cite" id="cite-${index}">`,
    '<div class="cite-head">',
    `<span class="cite-where"><b>${escapeHtml(source.id)}</b> ${escapeHtml(citation.path)}</span>`,
    `<span class="cite-lines">${range}</span>`,
    hasContext
      ? '<button class="cite-more" type="button" aria-expanded="false">context</button>'
      : '',
    `<button class="ask" type="button" data-ask="${escapeHtml(citationAsk(resolved))}">ask</button>`,
    '</div>',
    `<div class="cite-code">${code}</div>`,
    citation.caption ? `<figcaption>${inlineMarkdown(citation.caption)}</figcaption>` : '',
    '</figure>',
  ]
    .filter(Boolean)
    .join('');
}

function makeMarkdown(highlighter: Highlighter, sources: ResolvedSource[]): Marked {
  const marked = new Marked({ gfm: true });

  marked.use({
    renderer: {
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
        const ask = depth <= 3
          ? `<button class="ask" type="button" data-ask="${escapeHtml(
              sectionAsk(stripTags(inner), sources),
            )}">ask</button>`
          : '';
        return `<h${depth}>${inner}${ask}</h${depth}>`;
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
        `${s.base ? ` <span class="pin-base">base ${escapeHtml(s.base)}</span>` : ''}</li>`,
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

export async function renderDocument(
  doc: Doc,
  resolution: Resolution,
  _options: RenderOptions = {},
): Promise<string> {
  const highlighter = await getHighlighter();
  const markdown = makeMarkdown(highlighter, resolution.sources);

  const byCitation = new Map(resolution.citations.map(c => [c.citation, c]));
  const inlineMarkdown = (text: string) => markdown.parseInline(text) as string;
  let citationIndex = 0;

  const body = doc.blocks
    .map(block => {
      if (block.kind === 'prose') return markdown.parse(block.markdown) as string;
      const resolved = byCitation.get(block);
      if (!resolved) return '';
      citationIndex += 1;
      return renderCitation(resolved, highlighter, citationIndex, inlineMarkdown);
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.title ?? 'explorer')}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
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
