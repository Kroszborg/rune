import { type RenderOptions, toSVGString } from '@kroszborg/rune';

/**
 * Server-rendered QR (no hooks) - safe in React Server Components.
 *
 * The core already namespaces gradient ids per distinct QR, so multiple codes
 * on one page never cross-reference; no extra id handling is needed here.
 */
export function StaticQR({ className, ...options }: RenderOptions & { className?: string }) {
  return (
    <span
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: library-generated SVG.
      dangerouslySetInnerHTML={{ __html: toSVGString(options) }}
    />
  );
}
