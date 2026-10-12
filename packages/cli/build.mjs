import { build } from 'esbuild'

// Bundles everything, including the Courier Prime font bytes, into one file
// so the CLI runs anywhere Node runs with no install step.
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/spec.mjs',
  banner: { js: '#!/usr/bin/env node' },
  loader: { '.ttf': 'binary' },
  logLevel: 'info'
})
