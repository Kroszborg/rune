# @kroszborg/rune-react

## 1.0.0

### Major Changes

- 1.0: logo-safe error correction, multi-segment encoding, protected alignment patterns.

  **Encoder**

  - Mixed payloads are split into numeric / alphanumeric / byte segments with an exact
    dynamic-programming solver, producing the same (smallest) symbol as `node-qrcode`.
  - New `eci` option emits a UTF-8 ECI header for non-Latin-1 text (opt-in).
  - `encode('')` now throws instead of producing a blank symbol.
  - `RuneMatrix.layout` exposes which codeword every module carries and its Reed–Solomon block.

  **Renderer**

  - A logo no longer forces ECL `H`. The renderer counts the codewords the logo damages per
    block and steps `M → Q → H` only as far as needed; if even `H` cannot absorb it the logo is
    shrunk to the largest safe size (`logo.clamp: false` opts out).
  - `logo` without `src` clears a plate for an overlay; `renderToParts().logo` reports the box,
    and `SvgParts` now carries `version` and `ecl`.
  - Alignment patterns are drawn as solid shapes (`corners.alignment.style`: `square` default,
    `rounded`, `circle`, or `inherit` for the old behaviour).
  - Frame CTA text is measured, shrunk and ellipsised so it never overflows the band.

  **Adapters**

  - React `logoElement` now clears the modules behind it, sets the ECL, and stays centred on the
    code under a frame. Memoisation no longer JSON-stringifies props on every render.
  - Vue: the default slot is the logo, with the same handling.
  - `<rune-qr>` reads `corner-style`, `corner-dot-style`, `corner-color`, `alignment-style`,
    `logo`, `logo-size`, `frame-style`, `frame-text`, `frame-color` attributes.

  **Packaging**

  - `@resvg/resvg-js`, `sharp` and `pdf-lib` moved from `optionalDependencies` to optional
    `peerDependencies`; a browser project no longer downloads native binaries.
  - Source maps are no longer shipped in the tarballs.

  **Tests**

  - Scan-back now covers all nine dot styles (diamond and star included), every finder style in
    both polarities, dense version-30+ symbols, logos at every level, and ECI/multi-segment payloads.

  **Hardening (production audit)**

  - Every option is validated up front: unknown style/preset names, non-finite numbers,
    empty gradients and bad ECLs throw a `RangeError` naming the option. ECL accepts
    `H` / `h` / `high`. `undefined` option values no longer override preset values
    (Vue/WC `preset="midnight"` used to render white-on-white).
  - Stepping the ECL up for a logo can no longer throw `Data too long` for payloads that
    fit at M, or when `qr.version` is pinned; the logo is shrunk instead.
  - Default `aria-label` no longer includes non-URL payloads (WiFi passwords were read
    aloud); new `title` and `idPrefix` options.
  - `eci: true` now emits the header for any non-ASCII text, including Latin-1 accents.
  - Data builders: vCard/iCalendar values are RFC-escaped with CRLF, events are wrapped in
    `VCALENDAR`, bad dates throw, `url('localhost:3000')` gets a scheme, MECARD names keep
    their separator, `geo` validates coordinates.
  - Raster export: `scale` option, WebP keeps alpha, `quality`/`format`/`size` validated,
    `http(s):` logos are fetched and inlined (`inlineRemoteImages`), missing-peer errors
    carry the install command and `cause`. `toPDF` renders at 4× and accepts `page` and
    `printSize`.
  - React: unknown props (`id`, `onClick`, `data-*`) are forwarded to the `<svg>`, gradient
    ids use `useId()`, empty `value` renders nothing. Vue: `id` falls through, empty `value`
    renders nothing. Web Component: renders are coalesced per microtask and skipped while
    disconnected, errors surface as a `rune-error` event, `options` set before upgrade is
    honoured.
  - Decoder: Kanji / Structured Append / FNC1 throw `UnsupportedModeError` instead of
    returning truncated text; multi-byte ECI designators and charsets are honoured; alpha is
    composited over white so transparent PNGs decode; ragged matrices and short image
    buffers throw.
  - CLI: unknown flags are rejected (a typo used to be encoded into the payload), `--version`
    reads package.json, `-h`/`-v` work anywhere, `--` and stdin (`-`) are supported, values
    are validated before output, `-o -` streams to stdout, local logos are inlined, and new
    flags cover alignment, logo size/shape, frame style/colour, ECI, version, mask, scale,
    quality, title and aria-label.
  - Packaging: `exports` now points CommonJS TypeScript consumers at the `.d.cts` files
    (fixes TS1479 under `node16`), `typesVersions` covers legacy `node10` resolution,
    LICENSE and CHANGELOG ship in every tarball, `engines` is declared, `sharp` peer range
    is `>=0.33 <1`, `react-dom` is no longer a peer of the React adapter, provenance is
    enabled.
  - CI runs on Linux, Windows and macOS across Node 20/22/24; releases go through
    changesets with npm provenance. Added SECURITY.md and CONTRIBUTING.md.

  **Removed limits**

  - Per-corner finder styling: `corners.topLeft` / `topRight` / `bottomLeft` override the
    shared ring/core style and fill for one corner.
  - Kanji mode, encode and decode. The encoder builds its Shift_JIS table lazily from the
    runtime's `TextDecoder` (no table in the bundle) and its output matches node-qrcode's
    Kanji mode bit-for-bit; `qr.kanji: false` disables it.
  - Decoder image path: local (block-adaptive) binarization for uneven lighting, perspective
    correction through the bottom-right alignment pattern, majority-vote module sampling,
    mirrored-image retry (`result.mirrored`), multiple finder-triple candidates, and
    Structured Append / FNC1 headers reported on the result instead of throwing.

### Patch Changes

- Updated dependencies
  - @kroszborg/rune@1.0.0
