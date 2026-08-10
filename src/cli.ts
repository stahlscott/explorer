import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDocument } from './parse.ts';
import { resolveDocument } from './resolve.ts';
import { renderDocument } from './render.ts';
import { DEFAULT_SKIN, isSkinName, SKINS } from './styles/skins.ts';

type Write = (line: string) => void;
type Launch = (path: string) => void;

const CONTEXT_LINES = 12;

const USAGE = `usage: explorer <command> [options]

  render <doc.md> -o <out.html>   resolve every citation and write one self-contained file
  check  <doc.md>                 resolve citations only; print each failure
  pin    <doc.md>                 record each source's current sha in the front matter

Options:
  --style <name>   reading surface: ${Object.keys(SKINS).join(", ")} (default ${DEFAULT_SKIN})
  --no-toc         leave out the section nav
  --open           open the artifact when it is written

Exit codes: 0 ok, 1 the document or its citations failed, 2 wrong usage.`;

/**
 * An absolute `file://` URL, because the point of rendering is that someone
 * reads it: a terminal linkifies this, and a relative path is a dead end for
 * whoever the document was written for.
 */
export function fileUrl(path: string): string {
  return pathToFileURL(resolve(path)).href;
}

export function openCommand(platform: string): string {
  if (platform === 'darwin') return 'open';
  if (platform === 'win32') return 'start';
  return 'xdg-open';
}

function launchDefault(path: string): void {
  const command = openCommand(process.platform);
  execFileSync(command, [path], { stdio: 'ignore', shell: command === 'start' });
}

interface Loaded {
  citations: number;
  references: number;
  html?: string;
}

/**
 * Parse and resolve, and report every citation failure. Returns null when the
 * document cannot be used, having already written the reasons to `err`.
 */
async function load(
  path: string,
  err: Write,
  wantHtml: boolean,
  skin: string = DEFAULT_SKIN,
  toc = true,
): Promise<Loaded | null> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    err(`cannot read ${path}`);
    return null;
  }

  let doc;
  try {
    doc = parseDocument(text);
  } catch (error) {
    err(`${path}: ${(error as Error).message}`);
    return null;
  }

  const resolution = resolveDocument(doc, { contextLines: CONTEXT_LINES });
  if (resolution.failures.length > 0) {
    for (const failure of resolution.failures) err(failure.message);
    return null;
  }

  if (!wantHtml) {
    return { citations: resolution.citations.length, references: resolution.references.size };
  }

  return {
    citations: resolution.citations.length,
    references: resolution.references.size,
    html: await renderDocument(doc, resolution, { contextLines: CONTEXT_LINES, skin, toc }),
  };
}

/**
 * Rewrites each source's `sha:` to whatever its head ref points at now. Pinning
 * is a separate, deliberate act: a document whose branch moved is reporting on a
 * tree that no longer exists, and repinning without re-reading the citations
 * just makes the prose wrong quietly instead of loudly.
 */
function pin(path: string, out: Write, err: Write): number {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    err(`cannot read ${path}`);
    return 1;
  }

  let doc;
  try {
    doc = parseDocument(text);
  } catch (error) {
    err(`${path}: ${(error as Error).message}`);
    return 1;
  }

  const lines = text.split('\n');
  let changed = 0;

  for (const source of doc.sources) {
    const directory = source.path.startsWith('~/')
      ? `${process.env.HOME}/${source.path.slice(2)}`
      : source.path;

    let head: string;
    try {
      head = execFileSync('git', ['-C', directory, 'rev-parse', '--verify', `${source.head}^{commit}`], {
        encoding: 'utf8',
      }).trim();
    } catch {
      err(`${source.id} cannot resolve ${source.head} in ${directory}`);
      return 1;
    }

    if (source.sha === head) {
      out(`${source.id} already at ${head.slice(0, 10)}`);
      continue;
    }

    // Anchor on the source's own `id:` line so several sources cannot collide.
    const idLine = lines.findIndex(line => line.trim().replace(/^-\s*/, '') === `id: ${source.id}`);
    if (idLine === -1) {
      err(`${source.id} could not be located in the front matter`);
      return 1;
    }

    const indent = lines[idLine]!.match(/^\s*(?:-\s*)?/)![0].replace(/-\s*$/, '  ');
    const existing = lines.findIndex(
      (line, i) => i > idLine && i < idLine + 12 && /^\s*sha:/.test(line),
    );

    if (existing !== -1) {
      out(`${source.id} ${source.sha?.slice(0, 10)} -> ${head.slice(0, 10)}`);
      lines[existing] = `${indent}sha: ${head}`;
    } else {
      out(`${source.id} pinned at ${head.slice(0, 10)}`);
      const headLine = lines.findIndex(
        (line, i) => i > idLine && i < idLine + 12 && /^\s*head:/.test(line),
      );
      lines.splice((headLine === -1 ? idLine : headLine) + 1, 0, `${indent}sha: ${head}`);
    }
    changed += 1;
  }

  if (changed > 0) writeFileSync(path, lines.join('\n'));
  return 0;
}

export async function run(
  argv: string[],
  out: Write,
  err: Write,
  launch: Launch = launchDefault,
): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
    if (command === undefined) {
      err(USAGE);
      return 2;
    }
    out(USAGE);
    return 0;
  }

  if (command === 'check') {
    const path = rest[0];
    if (path === undefined) {
      err('check needs a document: explorer check <doc.md>');
      return 2;
    }

    const loaded = await load(path, err, false);
    if (!loaded) return 1;

    out(
      `${loaded.citations} citation${loaded.citations === 1 ? '' : 's'} and ` +
        `${loaded.references} file reference${loaded.references === 1 ? '' : 's'} resolved`,
    );
    return 0;
  }

  if (command === 'render') {
    const path = rest[0];
    if (path === undefined) {
      err('render needs a document: explorer render <doc.md> -o <out.html>');
      return 2;
    }

    const flag = rest.indexOf('-o');
    const output = flag === -1 ? undefined : rest[flag + 1];
    if (output === undefined) {
      err('render needs an output path: -o <out.html>');
      return 2;
    }

    const styleFlag = rest.indexOf('--style');
    const styleName = styleFlag === -1 ? DEFAULT_SKIN : rest[styleFlag + 1];
    if (styleName === undefined || !isSkinName(styleName)) {
      err(`unknown style '${styleName ?? ''}'; choose one of ${Object.keys(SKINS).join(', ')}`);
      return 2;
    }

    const loaded = await load(path, err, true, styleName, !rest.includes('--no-toc'));
    // Nothing is written unless every citation resolved.
    if (!loaded?.html) return 1;

    try {
      writeFileSync(output, loaded.html);
    } catch (error) {
      err(`cannot write ${output}: ${(error as Error).message}`);
      return 1;
    }

    out(
      `${fileUrl(output)} — ${loaded.citations} citation${loaded.citations === 1 ? '' : 's'}, ` +
        `${loaded.references} file reference${loaded.references === 1 ? '' : 's'}`,
    );

    if (rest.includes('--open')) {
      try {
        launch(resolve(output));
      } catch (error) {
        // The artifact is written and its URL is printed; failing to open it is
        // an inconvenience, not a failed render.
        err(`could not open ${output}: ${(error as Error).message}`);
      }
    }
    return 0;
  }

  if (command === 'pin') {
    const path = rest[0];
    if (path === undefined) {
      err('pin needs a document: explorer pin <doc.md>');
      return 2;
    }
    return pin(path, out, err);
  }

  err(`unknown command '${command}'\n\n${USAGE}`);
  return 2;
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return import.meta.filename === realpathSync(entry);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  const code = await run(
    process.argv.slice(2),
    line => process.stdout.write(`${line}\n`),
    line => process.stderr.write(`${line}\n`),
  );
  process.exit(code);
}
