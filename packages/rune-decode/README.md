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

## What is supported

| Area | Status |
| --- | --- |
| Versions 1–40, all four ECLs, all eight masks | yes |
| Numeric, alphanumeric and byte modes; multi-segment payloads | yes |
| ECI headers (UTF-8, ISO-8859-x, Shift_JIS, UTF-16BE, GB18030, EUC-KR) | yes, charset honoured |
| Format-information BCH correction (up to 3 bit errors, both copies) | yes |
| Reed–Solomon correction | yes, up to ⌊ecc/2⌋ errors per block |
| Kanji mode, Structured Append, FNC1 | **no**: `UnsupportedModeError` is thrown rather than returning truncated text |
| Image input | clean, upright or rotated images; alpha is composited over white |
| Mirrored images, strong perspective, uneven lighting, < 3 px per module | **no**; use a camera-grade decoder such as ZXing for those |

Invalid input (a ragged matrix, an image buffer shorter than `width × height × 4`) throws a
descriptive error instead of returning `null`.

MIT © 2026 Abhiman Panwar
