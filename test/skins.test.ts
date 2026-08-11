import { describe, expect, it } from 'vitest';
import { allSkinsCss, DEFAULT_SKIN, MODES, scopeRules, SKINS } from '../src/styles/skins.ts';

describe('scoping a skin so several can ship together', () => {
  const SCOPE = ':root[data-skin="panel"]';

  it('prefixes an ordinary selector as a descendant', () => {
    expect(scopeRules('h2 { color: red; }', SCOPE)).toContain(`${SCOPE} h2 {`);
  });

  it('replaces a leading :root rather than nesting it', () => {
    // `:root` inside `:root[data-skin=x]` is a descendant of the root element,
    // which matches nothing. A skin's token block would silently do nothing.
    const out = scopeRules(':root { --size-prose: 1rem; }', SCOPE);

    expect(out).toContain(`${SCOPE} {`);
    expect(out).not.toContain(`${SCOPE} :root`);
  });

  it('scopes every selector in a comma-separated list', () => {
    const out = scopeRules('h1, h2, h3 { text-transform: uppercase; }', SCOPE);

    for (const tag of ['h1', 'h2', 'h3']) expect(out).toContain(`${SCOPE} ${tag}`);
  });

  it('keeps pseudo-elements attached to their selector', () => {
    expect(scopeRules('h2::before { content: "> "; }', SCOPE)).toContain(`${SCOPE} h2::before`);
  });

  it('carries comments through untouched', () => {
    const out = scopeRules('/* why this exists */\nth { color: red; }', SCOPE);

    expect(out).toContain('/* why this exists */');
    expect(out).toContain(`${SCOPE} th`);
  });

  it('leaves no unscoped rule that could leak between skins', () => {
    for (const name of Object.keys(SKINS)) {
      const scope = `:root[data-skin="${name}"]`;
      const scoped = scopeRules(SKINS[name]!.rules, scope);
      const selectors = [...scoped.matchAll(/([^{}]*)\{/g)]
        .map(match => match[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim())
        .filter(Boolean);

      expect(selectors.length, `${name} has rules`).toBeGreaterThan(0);
      expect(
        selectors.filter(selector => !selector.startsWith(scope)),
        `${name} leaks these selectors`,
      ).toEqual([]);
    }
  });
});

describe('every skin ships in one artifact', () => {
  const css = allSkinsCss();

  it('emits a scoped palette for each skin', () => {
    for (const name of Object.keys(SKINS)) {
      expect(css, name).toContain(`:root[data-skin="${name}"]`);
    }
  });

  it('keeps the system preference working for the default skin', () => {
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(`:root[data-skin="${DEFAULT_SKIN}"]:not([data-theme="light"])`);
  });

  it('stays small enough that shipping all of them is free', () => {
    expect(css.length).toBeLessThan(24_000);
  });
});

describe('the reading modes a reader cycles through', () => {
  it('starts on the default skin following the system preference', () => {
    expect(MODES[0]).toMatchObject({ skin: DEFAULT_SKIN, theme: null });
  });

  it('names a skin that exists, for every mode', () => {
    for (const mode of MODES) expect(Object.keys(SKINS), mode.id).toContain(mode.skin);
  });

  it('gives every mode a distinct id and a label to show on the button', () => {
    const ids = MODES.map(mode => mode.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const mode of MODES) expect(mode.label.length, mode.id).toBeGreaterThan(0);
  });

  it('reaches every skin', () => {
    expect(new Set(MODES.map(mode => mode.skin))).toEqual(new Set(Object.keys(SKINS)));
  });
});
