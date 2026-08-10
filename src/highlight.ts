import { createHighlighter, type Highlighter } from 'shiki';

/**
 * Every language the bundled themes need to render. Kept explicit so the
 * artifact carries only these grammars — a full Shiki bundle is megabytes.
 */
const LANGUAGES = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'python',
  'json',
  'yaml',
  'markdown',
  'shellscript',
  'html',
  'css',
  'sql',
] as const;

export const THEMES = { light: 'github-light', dark: 'github-dark' } as const;

const BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  py: 'python',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  html: 'html',
  css: 'css',
  sql: 'sql',
};

export function languageForPath(path: string): string {
  const name = path.split('/').pop() ?? path;
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return 'text';
  return BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? 'text';
}

/** Shiki accepts any string; anything we did not bundle must fall back. */
export function bundledLanguage(lang: string): string {
  return (LANGUAGES as readonly string[]).includes(lang) ? lang : 'text';
}

let shared: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
  shared ??= createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs: [...LANGUAGES],
  });
  return shared;
}
