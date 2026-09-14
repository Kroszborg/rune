# Contributing to Rune

Thanks for helping. This is a pnpm + Turborepo monorepo; Node 20 or newer.

```bash
pnpm install
pnpm build        # every package (tsup)
pnpm test         # every package, including the scan-back round-trips
pnpm lint         # biome
pnpm typecheck
```

## Ground rules

- **A QR that does not scan is a bug, even if the tests pass.** Any new dot,
  finder, alignment or preset style must be added to
  `packages/rune/src/render/scannable.test.ts`, where it is rasterised and
  decoded back with jsQR at both a small and a version-30+ size.
- **The encoder must stay bit-for-bit identical to `node-qrcode`** for the
  reference samples in `packages/rune/src/core/qr.test.ts`.
- The core has zero runtime dependencies and must keep working in browsers,
  Node 20+, edge runtimes and React Native. Do not import Node built-ins
  outside `packages/rune/src/export/node.ts`.
- Optional native peers (`@resvg/resvg-js`, `sharp`, `pdf-lib`) are imported
  lazily with literal specifiers and must stay in tsup `external`.

## Changesets

Every user-visible change needs a changeset:

```bash
pnpm changeset
```

Pick the affected packages and a bump level, describe the change for the
CHANGELOG, and commit the generated file with your PR. Releases are cut by the
Release workflow from the accumulated changesets.

## Pull requests

- Keep PRs focused; one behaviour change per PR is ideal.
- Add or update tests next to the code you change.
- Run `pnpm lint && pnpm typecheck && pnpm test` before pushing. CI runs the
  same on Linux, Windows and macOS across Node 20, 22 and 24.
