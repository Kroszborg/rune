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
| `corners` | `CornerOptions` | — | Finder ring + core styles/fills |
| `background` | `string \| BackgroundOptions` | `'#ffffff'` | Color, gradient, or image; `'transparent'` accepted |
| `logo` | `LogoOptions` | — | Center logo. ECL auto-raised to `H` (unless you set one) and logo size clamped per ECL to stay scannable |
| `frame` | `FrameOptions` | — | Outer frame + CTA text |
| `qr` | `{ errorCorrectionLevel, version, mask }` | — | Encoding controls |
| `preset` | `PresetName` | — | Named base style |
| `ariaLabel` | `string` | `QR code: {value}` | Accessible label |

**Dot styles:** `square · dot · rounded · extra-rounded · classy · classy-rounded · leaf · diamond · star`
**Finder ring:** `square · rounded · extra-rounded · circle · leaf`
**Finder core:** `square · rounded · dot`

## Export helpers

```ts
import { toDataURL } from '@kroszborg/rune';          // browser (Canvas): PNG/JPEG/WebP
import { toBuffer, toPDF } from '@kroszborg/rune/node'; // Node: PNG/JPEG/WebP/PDF
```

Node raster/PDF output uses the optional peers `@resvg/resvg-js`, `sharp`, and `pdf-lib`,
imported lazily so the main entry stays free of native binaries.

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
