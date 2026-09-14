# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | yes |
| < 1.0 | no |

## Reporting a vulnerability

Please do not open a public issue for security reports. Use GitHub's private
vulnerability reporting on this repository ("Report a vulnerability" under the
Security tab), or email the maintainer listed in `package.json`.

You will get an acknowledgement within 72 hours and a fix or mitigation plan
within 14 days for confirmed issues. Credit is given in the release notes
unless you prefer otherwise.

## Scope and design notes

- The core (`@kroszborg/rune`) has no runtime dependencies. The renderer escapes
  every attribute and text value it emits, rejects `javascript:` and other
  non-image logo sources, and never evaluates user input.
- Raster export peers (`@resvg/resvg-js`, `sharp`, `pdf-lib`) are optional and
  loaded lazily; keep them updated in your own lockfile.
- `inlineRemoteImages` (used by raster export) fetches `http(s):` logo and
  background URLs you pass. Treat those URLs as you would any outbound request
  from your server.
