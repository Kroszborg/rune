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
</template>
```

Accepts the full [`RuneOptions`](https://rune.kroszborg.co/docs) as props and renders a real
`<svg>` (SSR-safe). Vue 3.3+ peer.

MIT © 2026 Abhiman Panwar
