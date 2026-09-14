# @kroszborg/rune

The framework-agnostic core of [Rune](https://rune.kroszborg.co) — a lightweight, fully
customizable QR code library. Pure SVG, zero runtime dependencies, built from scratch per
ISO/IEC 18004.

```bash
pnpm add @kroszborg/rune
```

## Rendering

```ts
import { toSVGString } from '@kroszborg/rune';

const svg = toSVGString({
  value: 'https://example.com',
  dots: { style: 'rounded', color: '#0b0b0f' },
  corners: { square: { style: 'extra-rounded' }, dot: { style: 'dot' } },
  background: '#ffffff',
});
```

`toSVGString` is synchronous, DOM-free, and SSR/edge-safe. `renderToParts` returns the SVG
attributes + body for building a real `<svg>` in a framework (used by the adapters).

## Options (`RuneOptions`)

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` | — | Data to encode (required) |
| `size` | `number` | `256` | Output width/height in px |
| `margin` | `number` | `4` | Quiet zone in modules |
| `dots` | `{ style, color, gradient }` | — | Data-module style + fill |
| `corners` | `CornerOptions` | — | Finder ring + core + alignment-pattern styles/fills |
| `background` | `string \| BackgroundOptions` | `'#ffffff'` | Color, gradient, or image; `'transparent'` accepted |
| `logo` | `LogoOptions` | — | Center logo (image, or a bare plate when `src` is omitted). See *Logos* below |
| `frame` | `FrameOptions` | — | Outer frame + CTA text |
| `qr` | `{ errorCorrectionLevel, version, mask, eci, boostEcl, kanji }` | — | Encoding controls. ECL accepts `H`, `h` or `high`; `eci` adds a UTF-8 header for strict readers; `kanji` (default on) packs Japanese text at 13 bits/char |
| `preset` | `PresetName` | — | Named base style |
| `ariaLabel` | `string` | see below | Accessible label. Defaults to `QR code: {value}` for short http(s) URLs and plain `QR code` otherwise, so WiFi passwords are never read aloud |
| `title` | `string` | — | `<title>` element (tooltip) inside the SVG |
| `idPrefix` | `string` | hash | Namespace for gradient ids when several identical codes share a page |

**Dot styles:** `square · dot · rounded · extra-rounded · classy · classy-rounded · leaf · diamond · star`
**Finder ring:** `square · rounded · extra-rounded · circle · leaf`
**Finder core:** `square · rounded · dot`
**Alignment patterns:** `square · rounded · circle · inherit` (solid by default so decoders can
still locate them; `inherit` styles them like the data)
**Per-corner finders:** `corners.topLeft` / `topRight` / `bottomLeft` take `{ square, dot }` and
override the shared finder style for that corner only.

`value` must be non-empty; an empty string throws rather than rendering a blank symbol.
Mixed payloads are split into numeric / alphanumeric / byte / Kanji segments for the smallest
symbol. Kanji mode builds its Shift_JIS table from the runtime's own `TextDecoder` the first
time it is needed, so nothing ships in the bundle; where that decoder is missing (Node built
with small-icu) Japanese text simply uses byte mode.

**Validation.** Every option is checked before anything is drawn. Unknown style or preset
names, a non-finite `size`, a negative `margin`, an empty gradient, a bad ECL and the like
throw a `RangeError` whose message names the option, instead of producing a broken SVG.
`validateOptions(options)` is exported if you want to check ahead of time (the CLI does).
Keys whose value is `undefined` are ignored, so forwarding every prop from a framework
component never overrides a preset.

## Logos

A logo hides part of the code. Rune does not force ECL `H` for it (denser codes are *harder*
to scan). It counts exactly how many codewords the logo covers in each Reed–Solomon block and
steps the level up `M → Q → H` only as far as that damage requires, keeping 30% of the
correction capacity for real-world wear. If even `H` cannot absorb the logo (small symbols
have little redundancy) the logo is shrunk to the largest safe size; pass `clamp: false` to
keep the exact size, or pin `qr.errorCorrectionLevel` to choose the level yourself.

```ts
toSVGString({ value, logo: { src: '/logo.svg', size: 0.2, shape: 'circle' } });
// Bare plate for an overlay (used by the React/Vue adapters):
const { body, logo } = renderToParts({ value, logo: { size: 0.2 } }); // logo = { x, y, width, height }
```

## Export helpers

```ts
import { toDataURL } from '@kroszborg/rune';          // browser (Canvas): PNG/JPEG/WebP
import { toBuffer, toPDF } from '@kroszborg/rune/node'; // Node: PNG/JPEG/WebP/PDF

await toDataURL(options, { format: 'png', scale: 2 });          // scale defaults to devicePixelRatio
await toBuffer(options, { format: 'webp', quality: 0.9 });       // Node: scale defaults to 1
await toPDF(options, { page: { width: 595, height: 842 }, printSize: 200 }); // A4, centred
```

`RasterOptions`: `format` (`png` default, `jpeg`, `webp`), `quality` 0–1, `scale`,
`background` (JPEG only; PNG and WebP keep alpha), `inlineRemoteImages` (default `true`:
`http(s):` logo and background images are fetched and embedded, because neither Canvas nor
resvg loads remote images on its own). `toPDF` renders at 4× for print and accepts `page`
and `printSize` in points. Output above 16384 px, an out-of-range `quality` or an unknown
`format` throw a `RangeError`.

Node raster/PDF output uses the optional peer packages `@resvg/resvg-js`, `sharp`, and
`pdf-lib`. They are imported lazily and are **not** installed automatically — add the ones you
need. The main entry has no dependencies at all.

## Data builders

```ts
import { data } from '@kroszborg/rune';

data.wifi({ ssid: 'Home', password: 'hunter2' });
data.vcard({ fullName: 'Ada Lovelace', email: 'ada@x.com' });
data.geo({ lat: 26.9124, lng: 75.7873 });
// url · email · sms · tel · mecard · event · crypto
```

## Presets

`minimal · dots · fluid · mint · midnight · sunset` — all verified scannable.

## License

MIT © 2026 Abhiman Panwar ([@kroszborg](https://github.com/kroszborg))
