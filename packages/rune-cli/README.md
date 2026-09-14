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
rune "https://example.com" --gradient "#0f7a5c,#12946e,45" -o qr.pdf --scale 4
rune "SCAN ME" --frame "SCAN ME" --frame-style square -o cta.png
rune "https://example.com" --logo ./logo.svg --logo-size 0.15 -o branded.png
echo "https://example.com" | rune - -o qr.svg        # value from stdin
rune -- "-starts-with-a-dash"                          # everything after -- is the value
```

Output format is inferred from the extension (`.svg` `.png` `.jpg` `.jpeg` `.webp` `.pdf`);
with no `-o` the SVG is written to stdout, and `-o -` streams the file to stdout. Local logo
paths are inlined so they appear in PNG/PDF output. `--scale` sets raster density,
`--quality` JPEG/WebP quality, `--alignment`, `--eci`, `--qr-version`, `--mask`, `--title`
and `--aria-label` map to the core options of the same name.

Unknown flags and bad values are rejected with exit code 1 before anything is written; a
typo can never end up encoded in the QR.

PNG/JPEG/WebP/PDF output uses `@resvg/resvg-js`, `sharp` and `pdf-lib`, which are declared
as optional dependencies so they install with the CLI where a prebuilt binary exists. With
`--no-optional` the CLI still produces SVG and tells you which package a raster format needs.

## Decode

```bash
rune decode qr.png
```

Prints the decoded text. Needs the optional `sharp` dependency to read the image.

Run `rune --help` for the full option list.

MIT © 2026 Abhiman Panwar
