# @kroszborg/rune-decode

A from-scratch QR code **decoder** for [Rune](https://rune.kroszborg.co). Decodes a sampled
module matrix or raw image pixels, with full Reed–Solomon error correction.

```bash
pnpm add @kroszborg/rune-decode
```

## From an image (RGBA pixels)

```ts
import { decode } from '@kroszborg/rune-decode';

// `img` is an ImageData-like { data, width, height } (e.g. from a canvas)
const result = decode(img);
if (result) console.log(result.text, result.version, result.ecl);
```

Handles clean, upright (and rotated) images via finder-pattern detection and affine grid
sampling. Returns `null` if no decodable symbol is found.

## From a module matrix

```ts
import { decodeMatrix } from '@kroszborg/rune-decode';

// modules[y][x] — true = dark
const { text } = decodeMatrix(modules);
```

`decodeMatrix` is the algorithmic core: format decode → unmask → de-interleave →
Reed–Solomon correction → segment parse.

MIT © 2026 Abhiman Panwar
