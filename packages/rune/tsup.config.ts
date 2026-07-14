import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/node.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  minify: false,
  target: 'es2021',
  // Optional raster/PDF peers are imported lazily and must never be bundled
  // (they ship native `.node` binaries).
  external: ['@resvg/resvg-js', 'sharp', 'pdf-lib'],
});
