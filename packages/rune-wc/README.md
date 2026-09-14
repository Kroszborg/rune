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

Attributes: `value`, `size`, `margin`, `preset`, `dot-style`, `dot-color`, `corner-style`,
`corner-dot-style`, `corner-color`, `alignment-style`, `background`, `ecl`, `logo`,
`logo-size`, `frame-style`, `frame-text`, `frame-color`, `aria-label`. Gradients, background
images, logo plate options and pinned version/mask are property-only: set the element's
`.options` to a `RenderOptions` object (merged over the attributes). An empty `value` renders
nothing.

Renders are coalesced into one pass per microtask and skipped while the element is
disconnected, so setting many attributes costs one render; call `el.render()` to force one
synchronously. Invalid input never throws out of a lifecycle callback: the element clears
itself, logs the error, and dispatches a bubbling `rune-error` CustomEvent whose `detail` is
the `Error`.

MIT © 2026 Abhiman Panwar
