import { build } from 'esbuild';
import { chmodSync } from 'node:fs';

const outfile = 'dist/explorer.js';

await build({
  entryPoints: ['src/cli.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // Shiki's grammars and themes are data, and they must ship inside the binary:
  // the renderer cannot reach a CDN and neither can the artifact.
  //
  // `yaml` ships CJS that calls require('process'), which an ESM bundle cannot
  // do on its own. Hand it a real require.
  banner: {
    js: [
      '#!/usr/bin/env node',
      "import { createRequire as __createRequire } from 'node:module';",
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
  logLevel: 'info',
});

chmodSync(outfile, 0o755);
