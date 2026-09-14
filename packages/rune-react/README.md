# @kroszborg/rune-react

React component for [Rune](https://rune.kroszborg.co) — lightweight, fully customizable QR codes.

```bash
pnpm add @kroszborg/rune-react
```

```tsx
import { QRCode } from '@kroszborg/rune-react';

export default function App() {
  return (
    <QRCode
      value="https://example.com"
      dots={{ style: 'rounded' }}
      corners={{ square: { style: 'extra-rounded' } }}
    />
  );
}
```

Accepts the full [`RuneOptions`](https://rune.kroszborg.co/docs) plus:

- `style` — inline style on the `<svg>` (or the wrapper when `logoElement` is set)
- `logoElement` — a React node used as the logo. The core clears the modules behind it and
  picks the error-correction level exactly as it does for `logo.src`; size, margin, shape and
  plate color come from the `logo` prop. The node stays centred on the code even with a frame.

```tsx
<QRCode value="https://example.com" logo={{ size: 0.2 }} logoElement={<Logo />} />
```

Any other prop (`id`, `onClick`, `data-testid`, `tabIndex`, `aria-describedby`, …) is
forwarded to the `<svg>`. Gradient ids are namespaced per instance with `useId()`, so several
identical codes on one page never collide. An empty `value` renders nothing, so a controlled
input can start blank.

Renders a real `<svg>` element and works in SSR. Re-renders are skipped while the options are
structurally unchanged, so inline option objects are fine. Re-exports the core `toSVGString`,
`toDataURL`, `data` builders, and presets. React 18+ peer.

MIT © 2026 Abhiman Panwar
