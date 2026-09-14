# @kroszborg/rune-vue

Vue 3 component for [Rune](https://rune.kroszborg.co) — lightweight, fully customizable QR codes.

```bash
pnpm add @kroszborg/rune-vue
```

```vue
<script setup lang="ts">
import { QRCode } from '@kroszborg/rune-vue';
</script>

<template>
  <QRCode value="https://example.com" :dots="{ style: 'rounded' }" />
  <QRCode value="https://example.com" :logo="{ size: 0.2 }"><img src="/logo.svg" /></QRCode>
</template>
```

Accepts the full [`RuneOptions`](https://rune.kroszborg.co/docs) as props and renders a real
`<svg>` (SSR-safe). The default slot is the logo: the core clears the modules behind it and
picks the error-correction level exactly as for `logo.src`. Non-prop attributes (`id`,
`class`, listeners) fall through to the root element; an empty `value` renders nothing.
Vue 3.3+ peer.

MIT © 2026 Abhiman Panwar
