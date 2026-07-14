# @kroszborg/rune-cli

Generate and decode customizable QR codes from the terminal with [Rune](https://rune.kroszborg.co).

```bash
pnpm add -g @kroszborg/rune-cli
# or: npx @kroszborg/rune-cli "https://example.com" -o qr.png
```

## Generate

```bash
rune "https://example.com" -o qr.svg
rune "https://example.com" -o qr.png --dots rounded --square extra-rounded --preset mint
rune "https://example.com" --gradient "#0f7a5c,#12946e,45" -o qr.pdf
rune "SCAN ME" --frame "SCAN ME" -o cta.png
```

Output format is inferred from the extension (`.svg` `.png` `.jpeg` `.webp` `.pdf`); with no
`-o`, the SVG is written to stdout. PNG/JPEG/WebP/PDF need the optional `@resvg/resvg-js`,
`sharp`, and `pdf-lib` dependencies.

## Decode

```bash
rune decode qr.png
```

Prints the decoded text. Needs the optional `sharp` dependency to read the image.

Run `rune --help` for the full option list.

MIT © 2026 Abhiman Panwar
