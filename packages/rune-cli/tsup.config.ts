import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  clean: true,
  sourcemap: false,
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  external: ['@resvg/resvg-js', 'sharp', 'pdf-lib'],
});
