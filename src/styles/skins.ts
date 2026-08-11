/**
 * A skin is two palettes and a set of rules. Every skin ships in every artifact,
 * scoped behind `data-skin`, so the reading surface is the reader's choice in the
 * file they were sent rather than a flag whoever rendered it happened to pass.
 * All of them together cost a few kilobytes against a hundred, which is not a
 * trade worth making a reader lose.
 *
 * Palettes are emitted three times per skin — as the default, behind the system
 * preference, and behind an explicit `data-theme` — so a chosen theme overrides
 * the system rather than fighting it.
 */
export interface Skin {
  light: string;
  dark: string;
  rules: string;
}

/** One entry in the cycle the button walks: a skin, and a theme within it. */
export interface Mode {
  id: string;
  skin: string;
  /** null follows the reader's system preference. */
  theme: 'light' | 'dark' | null;
  label: string;
}

const SANS = 'ui-sans-serif, -apple-system, "Segoe UI", Inter, system-ui, sans-serif';
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';
const SERIF = 'Iowan Old Style, Palatino, "Palatino Linotype", Georgia, serif';
const COMIC = '"Comic Sans MS", "Chalkboard SE", "Comic Neue", cursive';

/**
 * Panel. The one meant for reading: white or near-black, sans-serif, citations
 * as a tinted panel with a header band.
 *
 * Prose sits at a readable measure and code gets a much wider one, because a
 * wrapped identifier is worse than a wide line. Both are centred in the same
 * column, so the difference reads as a figure bleeding wider rather than as
 * text stopping short — which is what an earlier left-aligned version looked
 * like.
 */
const PANEL: Skin = {
  light: `
  --paper: #ffffff;
  --card: #f7f8fa;
  --wash: #eef1f5;
  --ink: #15171c;
  --ink-soft: #4b515c;
  --ink-faint: #8a919d;
  --rule: #e2e6ed;
  --accent: #1f5fd0;
  --shadow: 0 1px 2px rgba(20, 24, 33, .05);
`,
  dark: `
  --paper: #0f1115;
  --card: #171a20;
  --wash: #1d222a;
  --ink: #e7eaf0;
  --ink-soft: #a7aeba;
  --ink-faint: #6e7684;
  --rule: #262b34;
  --accent: #7aa7ff;
  --shadow: none;
`,
  rules: `
:root {
  --font-prose: ${SANS};
  --font-head: ${SANS};
  --font-ui: ${SANS};
  --font-mono: ${MONO};
  --size-prose: 1.02rem;
  --size-code: .82rem;
  --size-h1: 1.95rem;
  --size-h2: 1.4rem;
  --size-h3: 1.08rem;
  --weight-head: 680;
  --measure-text: 36rem;
  --measure-code: 56rem;
  --line-prose: 1.62;
}
figure.cite {
  background: var(--card);
  border: 1px solid var(--rule);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--shadow);
}
.cite-head {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  padding: .45rem .85rem;
  background: var(--wash);
  border-bottom: 1px solid var(--rule);
  color: var(--ink-soft);
}
.cite pre.shiki { padding: .7rem 0; }
figure.cite figcaption {
  padding: .55rem .85rem .65rem;
  border-top: 1px solid var(--rule);
  background: var(--paper);
  font-size: .88rem;
  color: var(--ink-soft);
}
`,
};

/**
 * Terminal. Green on black, 5250-ish. Everything is monospace and citations are
 * drawn with box rules. Not the easiest read; the point is that it is a pleasure
 * to open.
 */
const TERMINAL: Skin = {
  light: `
  --paper: #0b1207;
  --card: #0e1709;
  --wash: #14210c;
  --ink: #4aff7a;
  --ink-soft: #33cc5a;
  --ink-faint: #1f7d38;
  --rule: #1f7d38;
  --accent: #b6ff00;
  --shadow: none;
`,
  dark: `
  --paper: #050a03;
  --card: #081005;
  --wash: #0d1a08;
  --ink: #5cff88;
  --ink-soft: #37d861;
  --ink-faint: #218a3d;
  --rule: #218a3d;
  --accent: #c9ff3d;
  --shadow: none;
`,
  rules: `
:root {
  --font-prose: ${MONO};
  --font-head: ${MONO};
  --font-ui: ${MONO};
  --font-mono: ${MONO};
  --size-prose: .95rem;
  --size-code: .88rem;
  --size-h1: 1.35rem;
  --size-h2: 1.1rem;
  --size-h3: 1rem;
  --weight-head: 700;
  --measure-text: 46rem;
  --measure-code: 58rem;
  --line-prose: 1.55;
}
body { text-shadow: 0 0 3px rgba(74, 255, 122, .25); }
h1, h2, h3 { text-transform: uppercase; letter-spacing: .08em; }
h2::before { content: "> "; color: var(--accent); }
h3::before { content: ">> "; color: var(--ink-faint); }
strong { color: var(--accent); font-weight: 700; }
figure.cite { border: 1px solid var(--rule); background: var(--card); }
.cite-head {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  padding: .3rem .6rem;
  border-bottom: 1px dashed var(--rule);
  color: var(--ink-soft);
  letter-spacing: .04em;
}
/* The source id may shout; the path may not. Uppercasing a path changes the
   characters a reader sees while textContent still matches the file, so no
   byte-identity check would catch it. */
.cite-head b { text-transform: uppercase; }
.cite pre.shiki { padding: .5rem 0; }
figure.cite figcaption {
  padding: .4rem .6rem;
  border-top: 1px dashed var(--rule);
  color: var(--ink-soft);
  font-size: .85rem;
}
/* One colour, like a real 5250. Syntax highlighting would be a lie here. */
.shiki span { color: var(--ink) !important; }
.line.ctx span { color: var(--ink-faint) !important; }
th { color: var(--accent); }
code { background: var(--wash); color: var(--accent); }
.toc a { text-transform: uppercase; letter-spacing: .04em; }
`,
};

/**
 * Newsprint. A broadsheet: warm paper, a serif at a newspaper measure, a red
 * masthead rule. The document's whole shape is borrowed from journalism — lead
 * first, then the findings, tapering — so one surface may as well look the part.
 */
const NEWSPRINT: Skin = {
  light: `
  --paper: #f6f2e9;
  --card: #efe9dc;
  --wash: #e6dfcd;
  --ink: #1a1712;
  --ink-soft: #4a4438;
  --ink-faint: #7d7566;
  --rule: #cec4ac;
  --accent: #a8321e;
  --shadow: none;
`,
  dark: `
  --paper: #17150f;
  --card: #1e1b14;
  --wash: #26221a;
  --ink: #ece5d4;
  --ink-soft: #b3aa95;
  --ink-faint: #7d7566;
  --rule: #3b3529;
  --accent: #e0725c;
  --shadow: none;
`,
  rules: `
:root {
  --font-prose: ${SERIF};
  --font-head: ${SERIF};
  --font-ui: ${SANS};
  --font-mono: ${MONO};
  --size-prose: 1.06rem;
  --size-code: .8rem;
  --size-h1: 2.4rem;
  --size-h2: 1.5rem;
  --size-h3: 1.1rem;
  --weight-head: 700;
  --measure-text: 34rem;
  --measure-code: 56rem;
  --line-prose: 1.55;
}
h1 {
  letter-spacing: -.01em;
  border-bottom: 3px double var(--rule);
  padding-bottom: .5rem;
}
h2 { font-style: italic; }
.question { border-left: 3px solid var(--accent); }
figure.cite {
  background: var(--card);
  border: 1px solid var(--rule);
  box-shadow: none;
}
.cite-head {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  padding: .4rem .8rem;
  background: var(--wash);
  border-bottom: 1px solid var(--rule);
  color: var(--ink-soft);
  font-family: var(--font-ui);
  font-size: .74rem;
}
.cite pre.shiki { padding: .6rem 0; }
figure.cite figcaption {
  padding: .5rem .8rem;
  border-top: 1px solid var(--rule);
  color: var(--ink-soft);
  font-size: .92rem;
  font-style: italic;
}
th { font-variant: small-caps; letter-spacing: .04em; }
`,
};

/**
 * Geocities. Under construction since 1997. Loud on purpose, and held honest by
 * the contrast guard in the browser suite, which is what an earlier attempt at
 * this was missing when it turned out to be unreadable.
 */
const GEOCITIES: Skin = {
  light: `
  --paper: #000080;
  --card: #1a1aa8;
  --wash: #2f2fc0;
  --ink: #ffff00;
  --ink-soft: #7dffff;
  --ink-faint: #b0b0ff;
  --rule: #ff00ff;
  --accent: #00ff00;
  --shadow: 3px 3px 0 #ff00ff;
`,
  dark: `
  --paper: #000040;
  --card: #101070;
  --wash: #1c1c92;
  --ink: #ffff66;
  --ink-soft: #66ffff;
  --ink-faint: #9c9cff;
  --rule: #ff33ff;
  --accent: #33ff33;
  --shadow: 3px 3px 0 #ff33ff;
`,
  rules: `
:root {
  --font-prose: ${COMIC};
  --font-head: ${COMIC};
  --font-ui: ${COMIC};
  --font-mono: ${MONO};
  --size-prose: 1rem;
  --size-code: .8rem;
  --size-h1: 2.1rem;
  --size-h2: 1.45rem;
  --size-h3: 1.1rem;
  --weight-head: 700;
  --measure-text: 36rem;
  --measure-code: 56rem;
  --line-prose: 1.6;
}
h1 { color: var(--ink); text-shadow: 2px 2px 0 var(--rule); }
h2 { color: var(--accent); }
h2::before { content: "~*~ "; color: var(--rule); }
h3 { color: var(--ink-soft); }
a { color: var(--accent); }
strong { color: var(--rule); }
figure.cite {
  background: var(--card);
  border: 3px ridge var(--rule);
  box-shadow: var(--shadow);
}
.cite-head {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  padding: .4rem .7rem;
  background: var(--wash);
  border-bottom: 2px groove var(--rule);
  color: var(--ink-soft);
}
/* Syntax tokens are picked for white or near-black, and on this navy they land
   at a contrast ratio of about 1.5 — which is what made an earlier version of
   this skin unreadable. The code panel goes almost black so the dark token set
   has something to sit on. A garish page around a black terminal panel is
   period-accurate anyway. */
.cite pre.shiki { padding: .6rem 0; background: #00001c; }
figure.cite figcaption {
  padding: .5rem .7rem;
  border-top: 2px groove var(--rule);
  color: var(--ink-soft);
}
table { border: 2px ridge var(--rule); }
th { color: var(--accent); background: var(--wash); }
code { background: var(--wash); color: var(--accent); }
.theme-toggle { border: 2px outset var(--rule); border-radius: 0; }
`,
};

export const SKINS: Record<string, Skin> = {
  panel: PANEL,
  terminal: TERMINAL,
  newsprint: NEWSPRINT,
  geocities: GEOCITIES,
};

export const DEFAULT_SKIN = 'panel';

/**
 * The cycle. Panel earns three entries because light and dark are a real
 * preference; the others are one look each — terminal's two palettes are both
 * green-on-black, so a light terminal would be a distinction without a difference.
 */
export const MODES: Mode[] = [
  { id: 'auto', skin: 'panel', theme: null, label: 'auto' },
  { id: 'light', skin: 'panel', theme: 'light', label: 'light' },
  { id: 'dark', skin: 'panel', theme: 'dark', label: 'dark' },
  { id: 'newsprint', skin: 'newsprint', theme: 'light', label: 'newsprint' },
  { id: 'terminal', skin: 'terminal', theme: 'dark', label: 'terminal' },
  // Dark, so the code panel gets the token set meant for dark backgrounds.
  { id: 'geocities', skin: 'geocities', theme: 'dark', label: 'geocities' },
];

const BLOCK = /([^{}]*)\{([^{}]*)\}/g;
const COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * Prefix every selector in a skin's rules with its scope, so all skins can ship
 * side by side. The rules are flat by construction — no nesting, no at-rules —
 * which is why this needs no CSS parser.
 *
 * A selector starting with `:root` is *replaced* rather than nested: `:root`
 * inside `:root[data-skin=x]` describes a root element inside the root element,
 * matches nothing, and would silently drop a skin's whole token block.
 */
export function scopeRules(rules: string, scope: string): string {
  return rules.replace(BLOCK, (_match, head: string, body: string) => {
    const comments = head.match(COMMENT) ?? [];
    const selectors = head
      .replace(COMMENT, '')
      .split(',')
      .map(selector => selector.trim())
      .filter(Boolean)
      .map(selector =>
        selector.startsWith(':root')
          ? `${scope}${selector.slice(':root'.length)}`
          : `${scope} ${selector}`,
      );

    const preamble = comments.length > 0 ? `${comments.join('\n')}\n` : '\n';
    return `${preamble}${selectors.join(',\n')} {${body}}`;
  });
}

/**
 * Every skin, each behind its own `data-skin`. The attribute is written into the
 * markup rather than set by script, so a reader with JavaScript off still gets a
 * designed page instead of unstyled tokens.
 */
export function allSkinsCss(): string {
  return Object.entries(SKINS)
    .map(([name, skin]) => {
      const scope = `:root[data-skin="${name}"]`;
      return `
${scope} {${skin.light}}
@media (prefers-color-scheme: dark) {
  ${scope}:not([data-theme="light"]) {${skin.dark}}
}
${scope}[data-theme="dark"] {${skin.dark}}
${scope}[data-theme="light"] {${skin.light}}
${scopeRules(skin.rules, scope)}
`;
    })
    .join('\n');
}
