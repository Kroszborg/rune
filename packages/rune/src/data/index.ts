/**
 * Payload builders — turn structured input into correctly-escaped QR content
 * strings (WiFi, vCard, calendar events, …). Pass the result as `value`.
 */

/** Escape a value for WiFi / MECARD / vCard grammars (`\ ; , : "`). */
function escapeSpecial(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

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

/** A plain URL (normalized to include a scheme). */
export function url(value: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
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
  return `mailto:${to}${params.length ? `?${params.join('&')}` : ''}`;
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

/** vCard 3.0 contact payload. */
export function vcard(o: VCardOptions): string {
  const name = o.fullName ?? [o.firstName, o.lastName].filter(Boolean).join(' ');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (o.lastName || o.firstName) lines.push(`N:${o.lastName ?? ''};${o.firstName ?? ''};;;`);
  if (name) lines.push(`FN:${name}`);
  if (o.org) lines.push(`ORG:${o.org}`);
  if (o.title) lines.push(`TITLE:${o.title}`);
  if (o.phone) lines.push(`TEL;TYPE=CELL:${o.phone}`);
  if (o.email) lines.push(`EMAIL:${o.email}`);
  if (o.url) lines.push(`URL:${o.url}`);
  if (o.address) lines.push(`ADR:;;${o.address};;;;`);
  if (o.note) lines.push(`NOTE:${o.note}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

/** Compact MECARD contact payload. */
export function mecard(o: VCardOptions): string {
  const name = o.fullName ?? [o.lastName, o.firstName].filter(Boolean).join(',');
  const parts: string[] = [];
  if (name) parts.push(`N:${escapeSpecial(name)}`);
  if (o.phone) parts.push(`TEL:${o.phone}`);
  if (o.email) parts.push(`EMAIL:${o.email}`);
  if (o.url) parts.push(`URL:${escapeSpecial(o.url)}`);
  if (o.address) parts.push(`ADR:${escapeSpecial(o.address)}`);
  if (o.note) parts.push(`NOTE:${escapeSpecial(o.note)}`);
  return `MECARD:${parts.join(';')};;`;
}

function icalDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

export interface EventOptions {
  title: string;
  start: Date | string;
  end: Date | string;
  location?: string;
  description?: string;
}

/** iCalendar VEVENT payload. */
export function event(o: EventOptions): string {
  const lines = [
    'BEGIN:VEVENT',
    `SUMMARY:${o.title}`,
    `DTSTART:${icalDate(o.start)}`,
    `DTEND:${icalDate(o.end)}`,
  ];
  if (o.location) lines.push(`LOCATION:${o.location}`);
  if (o.description) lines.push(`DESCRIPTION:${o.description}`);
  lines.push('END:VEVENT');
  return lines.join('\n');
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
