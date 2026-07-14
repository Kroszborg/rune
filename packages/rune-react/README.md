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

- `style` — inline style on the `<svg>`
- `logoElement` — a React node rendered centered over the code (pair with
  `qr={{ errorCorrectionLevel: 'H' }}`)

Renders a real `<svg>` element and works in SSR. Re-exports the core `toSVGString`,
`toDataURL`, `data` builders, and presets. React 18+ peer.

MIT © 2026 Abhiman Panwar
