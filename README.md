<div align="center">

# Rune

**Lightweight, fully customizable, framework-agnostic QR codes.**
Pure SVG · Zero dependencies · Built from scratch per ISO/IEC 18004.

[Playground](https://rune.kroszborg.co/playground) · [API](https://rune.kroszborg.co/docs) · [Examples](https://rune.kroszborg.co/examples) · [Benchmark](https://rune.kroszborg.co/benchmark)

</div>

---

Rune generates clean, scannable, beautifully customizable QR codes. The core engine encodes from scratch per ISO/IEC 18004 and renders pure SVG — no canvas, no runtime dependencies. Thin adapters bring it to React, Vue, and vanilla / Web Components, and a separate engine decodes QR codes back to data.

## Packages

| Package | Description |
| --- | --- |
| [`@kroszborg/rune`](packages/rune) | Core engine: encoder, renderer, export helpers, data builders, presets |
| [`@kroszborg/rune-react`](packages/rune-react) | React `<QRCode>` component |
| [`@kroszborg/rune-vue`](packages/rune-vue) | Vue 3 `<QRCode>` component |
| [`@kroszborg/rune-wc`](packages/rune-wc) | Vanilla `renderRune()` + `<rune-qr>` Web Component |
| [`@kroszborg/rune-decode`](packages/rune-decode) | From-scratch QR decoder (matrix + image, Reed–Solomon correction) |
| [`@kroszborg/rune-cli`](packages/rune-cli) | `rune` command-line generator + decoder |

## Quick start

```bash
pnpm add @kroszborg/rune-react
```

```tsx
import { QRCode } from '@kroszborg/rune-react';

<QRCode
  value="https://example.com"
  dots={{ style: 'rounded' }}
  corners={{ square: { style: 'extra-rounded' } }}
/>;
```

Server-side / no framework:

```ts
import { toSVGString } from '@kroszborg/rune';
const svg = toSVGString({ value: 'https://example.com', dots: { style: 'rounded' } });
```

## Features

- **Pure SVG**, zero runtime dependencies in the core.
- **Four targets** — React, Vue, vanilla, Web Component — from one engine.
- **Every shape** — 6 dot styles, 5 finder rings, 3 finder cores, freely mixed.
- **Gradients** (linear/radial per element), **background images**, **frames + CTA text**, **logos** (auto-clamped per ECL).
- **Data builders** — WiFi, vCard, email, SMS, geo, calendar, crypto, and more.
- **Export** — `toSVGString` (sync/SSR), plus PNG · JPEG · WebP · PDF via optional peers (`@kroszborg/rune/node`).
- **Decoder** — decode QR codes from a module matrix or raw image pixels.
- **Verified correct** — the encoder matches `node-qrcode` bit-for-bit; every rendered style is proven scannable by decoding it back in CI.

## Development

```bash
pnpm install
pnpm build       # build all packages
pnpm test        # run all tests (incl. scan-back round-trips)
pnpm typecheck
pnpm --filter docs dev   # run the docs site locally
pnpm --filter bench bench  # run the benchmark harness
```

## License

MIT © 2026 Abhiman Panwar ([@kroszborg](https://github.com/kroszborg))
