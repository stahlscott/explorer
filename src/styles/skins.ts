/**
 * A skin is two palettes and a set of rules. The palettes are emitted three
 * times — as the default, behind the system preference, and behind an explicit
 * `data-theme` — so the toggle can override the system rather than fight it.
 */
export interface Skin {
  light: string;
  dark: string;
  rules: string;
}

const SANS = 'ui-sans-serif, -apple-system, "Segoe UI", Inter, system-ui, sans-serif';
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';

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
 * Geocities. Loud, and deliberately so. Honest in the one way that matters: the
 * code is still verbatim and still cited.
 */
const GEOCITIES: Skin = {
  light: `
  --paper: #000080;
  --card: #c0c0c0;
  --wash: #ffff00;
  --ink: #ffffff;
  --ink-soft: #ffff66;
  --ink-faint: #00ffff;
  --rule: #ff00ff;
  --accent: #00ff00;
  --shadow: 4px 4px 0 #000000;
`,
  dark: `
  --paper: #1a0033;
  --card: #2b2b2b;
  --wash: #4b0082;
  --ink: #ffff00;
  --ink-soft: #00ffff;
  --ink-faint: #ff69b4;
  --rule: #00ff00;
  --accent: #ff00ff;
  --shadow: 4px 4px 0 #000000;
`,
  rules: `
:root {
  --font-prose: "Comic Sans MS", "Chalkboard SE", ${SANS};
  --font-head: "Comic Sans MS", "Chalkboard SE", ${SANS};
  --font-ui: "Comic Sans MS", "Chalkboard SE", ${SANS};
  --font-mono: "Courier New", ${MONO};
  --size-prose: 1rem;
  --size-code: .84rem;
  --size-h1: 2.1rem;
  --size-h2: 1.5rem;
  --size-h3: 1.1rem;
  --weight-head: 700;
  --measure-text: 38rem;
  --measure-code: 56rem;
  --line-prose: 1.6;
}
h1 { color: var(--wash); text-shadow: 2px 2px 0 var(--rule), 4px 4px 0 #000; text-align: center; }
h2 { color: var(--accent); border-bottom: 3px ridge var(--rule); }
h3 { color: var(--ink-soft); }
h2::before { content: "\\2605 "; }
strong { color: var(--wash); }
figure.cite {
  background: var(--card);
  border: 3px ridge var(--rule);
  box-shadow: var(--shadow);
}
.cite-head {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  padding: .35rem .7rem;
  background: var(--rule);
  color: #ffffff;
}
.cite-head b, .cite-dir, .cite-file, .cite-lines { color: #ffffff; }
.cite-code { background: #ffffff; }
.cite pre.shiki { padding: .6rem 0; }
.cite .line::before { color: #6a6a6a; opacity: 1; }
figure.cite figcaption {
  padding: .45rem .7rem;
  background: var(--wash);
  color: #000000;
  border-top: 2px groove var(--rule);
  font-size: .88rem;
}
button.cite-more, button.ask, a.cite-link { color: #ffffff; }
button.cite-more:hover, button.ask:hover, a.cite-link:hover { color: var(--accent); background: #000; }
table { border: 2px ridge var(--rule); }
th { background: var(--rule); color: #fff; padding-left: .5rem; }
code { background: var(--wash); color: #000; padding: 0 .15em; }
/* Base strips the chip background inside a table, which left black on navy. */
td code { color: var(--ink-faint); }
.theme-toggle { background: #000000; color: var(--accent); border-color: var(--accent); }
header { border-bottom: 4px double var(--rule); }
`,
};

export const SKINS: Record<string, Skin> = {
  panel: PANEL,
  terminal: TERMINAL,
  geocities: GEOCITIES,
};

export const DEFAULT_SKIN = 'panel';

export function isSkinName(value: string): boolean {
  return value in SKINS;
}

/**
 * Light first, then the system preference unless a theme was chosen, then the
 * explicit choice. Emitting the palette three times is what lets the toggle win
 * without `!important`.
 */
export function skinCss(name: string): string {
  const skin = SKINS[name] ?? PANEL;
  return `
:root {${skin.light}}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {${skin.dark}}
}
:root[data-theme="dark"] {${skin.dark}}
:root[data-theme="light"] {${skin.light}}
${skin.rules}
`;
}
