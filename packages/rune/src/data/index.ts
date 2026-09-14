/**
 * Payload builders — turn structured input into correctly-escaped QR content
 * strings (WiFi, vCard, calendar events, …). Pass the result as `value`.
 */

/** Escape a value for the WiFi / MECARD grammars (`\ ; , : "`). */
function escapeSpecial(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

/** Escape a vCard / iCalendar text value (RFC 6350 §3.4 / RFC 5545 §3.3.11). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const CRLF = '\r\n';

export interface WifiOptions {
  ssid: string;
  password?: string;
  encryption?: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}

/** WiFi network join payload. */
export function wifi({ ssid, password, encryption = 'WPA', hidden = false }: WifiOptions): string {
  const type = password ? encryption : 'nopass';
  const parts = [`T:${type}`, `S:${escapeSpecial(ssid)}`];
  if (password && type !== 'nopass') parts.push(`P:${escapeSpecial(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

/**
 * A plain URL, normalized to include a scheme. `localhost:3000` and
 * `example.com:8080/x` are hosts with ports, not schemes.
 */
export function url(value: string): string {
  const v = value.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[a-z0-9.-]+:\d+(\/|$)/i.test(v);
  return hasScheme ? v : `https://${v}`;
}

export interface EmailOptions {
  to: string;
  subject?: string;
  body?: string;
  cc?: string;
  bcc?: string;
}

/** `mailto:` link with optional subject/body/cc/bcc. */
export function email({ to, subject, body, cc, bcc }: EmailOptions): string {
  // RFC 6068: use percent-encoding (spaces → %20). URLSearchParams would emit
  // '+' for spaces, which mailto clients do not decode back to a space.
  const params: string[] = [];
  const add = (key: string, value?: string) => {
    if (value) params.push(`${key}=${encodeURIComponent(value)}`);
  };
  add('subject', subject);
  add('body', body);
  add('cc', cc);
  add('bcc', bcc);
  // Keep '@' and ',' readable in the address; encode anything URL-unsafe.
  const addr = encodeURIComponent(to.trim()).replace(/%40/g, '@').replace(/%2C/g, ',');
  return `mailto:${addr}${params.length ? `?${params.join('&')}` : ''}`;
}

/** SMS payload (`SMSTO:` form, widely supported). */
export function sms({ to, body }: { to: string; body?: string }): string {
  return body ? `SMSTO:${to}:${body}` : `SMSTO:${to}`;
}

/** Telephone dial payload. */
export function tel(number: string): string {
  return `tel:${number}`;
}

/** Geographic coordinate payload. */
export function geo({
  lat,
  lng,
  altitude,
}: { lat: number; lng: number; altitude?: number }): string {
  for (const [name, v] of [
    ['lat', lat],
    ['lng', lng],
  ] as const) {
    if (!Number.isFinite(v)) throw new RangeError(`Rune: geo ${name} must be a finite number`);
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new RangeError('Rune: geo lat must be within ±90 and lng within ±180');
  }
  return altitude != null ? `geo:${lat},${lng},${altitude}` : `geo:${lat},${lng}`;
}

export interface VCardOptions {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  org?: string;
  title?: string;
  phone?: string;
  email?: string;
  url?: string;
  address?: string;
  note?: string;
}

/** vCard 3.0 contact payload (CRLF line endings, RFC-escaped values). */
export function vcard(o: VCardOptions): string {
  const name = o.fullName ?? [o.firstName, o.lastName].filter(Boolean).join(' ');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (o.lastName || o.firstName) {
    lines.push(`N:${escapeText(o.lastName ?? '')};${escapeText(o.firstName ?? '')};;;`);
  }
  if (name) lines.push(`FN:${escapeText(name)}`);
  if (o.org) lines.push(`ORG:${escapeText(o.org)}`);
  if (o.title) lines.push(`TITLE:${escapeText(o.title)}`);
  if (o.phone) lines.push(`TEL;TYPE=CELL:${o.phone}`);
  if (o.email) lines.push(`EMAIL:${o.email}`);
  if (o.url) lines.push(`URL:${o.url}`);
  if (o.address) lines.push(`ADR:;;${escapeText(o.address)};;;;`);
  if (o.note) lines.push(`NOTE:${escapeText(o.note)}`);
  lines.push('END:VCARD');
  return lines.join(CRLF);
}

/** Compact MECARD contact payload. */
export function mecard(o: VCardOptions): string {
  // MECARD N is "last,first"; escape each part so a comma inside a name
  // cannot be mistaken for the separator (and the separator itself is not escaped).
  const name = o.fullName
    ? escapeSpecial(o.fullName)
    : [o.lastName, o.firstName]
        .filter((part): part is string => Boolean(part))
        .map(escapeSpecial)
        .join(',');
  const parts: string[] = [];
  if (name) parts.push(`N:${name}`);
  if (o.phone) parts.push(`TEL:${o.phone}`);
  if (o.email) parts.push(`EMAIL:${o.email}`);
  if (o.url) parts.push(`URL:${escapeSpecial(o.url)}`);
  if (o.address) parts.push(`ADR:${escapeSpecial(o.address)}`);
  if (o.note) parts.push(`NOTE:${escapeSpecial(o.note)}`);
  return `MECARD:${parts.join(';')};;`;
}

function icalDate(value: Date | string, name: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`Rune: event ${name} is not a valid date: ${String(value)}`);
  }
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

export interface EventOptions {
  title: string;
  start: Date | string;
  end: Date | string;
  location?: string;
  description?: string;
}

/**
 * iCalendar event payload. Wrapped in `VCALENDAR` because several Android
 * scanners only recognise a `VEVENT` inside one.
 */
export function event(o: EventOptions): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `SUMMARY:${escapeText(o.title)}`,
    `DTSTART:${icalDate(o.start, 'start')}`,
    `DTEND:${icalDate(o.end, 'end')}`,
  ];
  if (o.location) lines.push(`LOCATION:${escapeText(o.location)}`);
  if (o.description) lines.push(`DESCRIPTION:${escapeText(o.description)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join(CRLF);
}

export interface CryptoOptions {
  coin?: 'bitcoin' | 'ethereum' | 'litecoin';
  address: string;
  amount?: number;
  label?: string;
}

/** Cryptocurrency payment URI (BIP-21 style). */
export function crypto({ coin = 'bitcoin', address, amount, label }: CryptoOptions): string {
  // BIP-21: percent-encode (spaces → %20), not '+'.
  const params: string[] = [];
  if (amount != null) params.push(`amount=${amount}`);
  if (label) params.push(`label=${encodeURIComponent(label)}`);
  return `${coin}:${address}${params.length ? `?${params.join('&')}` : ''}`;
}
