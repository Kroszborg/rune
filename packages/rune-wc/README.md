# @kroszborg/rune-wc

Vanilla JS + Web Component for [Rune](https://rune.kroszborg.co) — customizable QR codes with
no framework.

```bash
pnpm add @kroszborg/rune-wc
```

## Function

```ts
import { renderRune } from '@kroszborg/rune-wc';

renderRune(document.querySelector('#qr')!, {
  value: 'https://example.com',
  dots: { style: 'rounded' },
});
```

## `<rune-qr>` custom element

```ts
import { register } from '@kroszborg/rune-wc';
register();
```

```html
<rune-qr value="https://example.com" dot-style="rounded" preset="mint"></rune-qr>
```

Attributes: `value`, `size`, `margin`, `dot-style`, `dot-color`, `background`, `ecl`,
`preset`, `aria-label`. For full configuration, set the element's `.options` property to a
`RenderOptions` object.

MIT © 2026 Abhiman Panwar
