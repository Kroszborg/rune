/** Minimal, dependency-free SVG string builder (SSR-safe, no DOM). */

export type Attrs = Record<string, string | number | undefined>;

const AMP = /&/g;
const LT = /</g;
const GT = />/g;
const QUOT = /"/g;

export function escapeAttr(value: string): string {
  return value
    .replace(AMP, '&amp;')
    .replace(LT, '&lt;')
    .replace(GT, '&gt;')
    .replace(QUOT, '&quot;');
}

export function escapeText(value: string): string {
  return value.replace(AMP, '&amp;').replace(LT, '&lt;').replace(GT, '&gt;');
}

function attrsToString(attrs: Attrs): string {
  let out = '';
  for (const key in attrs) {
    const v = attrs[key];
    if (v === undefined) continue;
    out += ` ${key}="${escapeAttr(String(v))}"`;
  }
  return out;
}

/** Build a self-closing or container element string. */
export function el(tag: string, attrs: Attrs, children?: string): string {
  const a = attrsToString(attrs);
  if (children === undefined) return `<${tag}${a}/>`;
  return `<${tag}${a}>${children}</${tag}>`;
}

/** A `<text>` element with escaped text content. */
export function textEl(attrs: Attrs, content: string): string {
  return `<text${attrsToString(attrs)}>${escapeText(content)}</text>`;
}
