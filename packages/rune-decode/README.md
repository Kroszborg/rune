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

Binarizes with a local, shadow-tolerant threshold (falling back to a global one), locates the
finder patterns, refines the grid through the bottom-right alignment pattern into a perspective
transform, samples each module by majority vote, and retries mirrored. Rotated, tilted, unevenly
lit, transparent and front-camera images decode; `result.mirrored` tells you when the image was
flipped. Returns `null` if no decodable symbol is found.

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
| Numeric, alphanumeric, byte and Kanji modes; multi-segment payloads | yes (Kanji via the runtime's Shift_JIS `TextDecoder`) |
| ECI headers (UTF-8, ISO-8859-x, Shift_JIS, UTF-16BE, GB18030, EUC-KR) | yes, charset honoured |
| Structured Append and FNC1 headers | yes, reported as `result.structuredAppend` / `result.fnc1` |
| Format-information BCH correction (up to 3 bit errors, both copies) | yes |
| Reed–Solomon correction | yes, up to ⌊ecc/2⌋ errors per block |
| Image input | rotated, tilted (perspective), unevenly lit, transparent and mirrored images |
| Very low resolution (< ~3 px per module), heavy blur | **no**; use a camera-grade decoder such as ZXing for those |

Invalid input (a ragged matrix, an image buffer shorter than `width × height × 4`) throws a
descriptive error instead of returning `null`.

MIT © 2026 Abhiman Panwar
