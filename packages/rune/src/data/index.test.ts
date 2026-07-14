import { describe, expect, it } from 'vitest';
import { crypto, url, email, event, geo, mecard, sms, tel, vcard, wifi } from './index.js';

describe('data builders', () => {
  it('wifi escapes special characters', () => {
    expect(wifi({ ssid: 'My;Net', password: 'p:a,ss', encryption: 'WPA' })).toBe(
      'WIFI:T:WPA;S:My\\;Net;P:p\\:a\\,ss;;',
    );
    expect(wifi({ ssid: 'Open' })).toBe('WIFI:T:nopass;S:Open;;');
    expect(wifi({ ssid: 'H', password: 'x', hidden: true })).toContain('H:true');
  });

  it('url adds a scheme only when missing', () => {
    expect(url('example.com')).toBe('https://example.com');
    expect(url('http://x.com')).toBe('http://x.com');
    expect(url('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('email builds a mailto with percent-encoded query (spaces as %20, not +)', () => {
    expect(email({ to: 'a@b.com', subject: 'Hi there', body: 'Yo' })).toBe(
      'mailto:a@b.com?subject=Hi%20there&body=Yo',
    );
    expect(email({ to: 'a@b.com' })).toBe('mailto:a@b.com');
  });

  it('sms, tel, geo', () => {
    expect(sms({ to: '+15551234', body: 'hi' })).toBe('SMSTO:+15551234:hi');
    expect(tel('+15551234')).toBe('tel:+15551234');
    expect(geo({ lat: 12.34, lng: 56.78 })).toBe('geo:12.34,56.78');
    expect(geo({ lat: 1, lng: 2, altitude: 3 })).toBe('geo:1,2,3');
  });

  it('vcard and mecard', () => {
    const v = vcard({
      firstName: 'Ada',
      lastName: 'Lovelace',
      org: 'Analytical',
      email: 'ada@x.com',
    });
    expect(v).toContain('BEGIN:VCARD');
    expect(v).toContain('FN:Ada Lovelace');
    expect(v).toContain('N:Lovelace;Ada;;;');
    expect(v).toContain('END:VCARD');
    expect(mecard({ fullName: 'Ada Lovelace', phone: '123' })).toBe(
      'MECARD:N:Ada Lovelace;TEL:123;;',
    );
  });

  it('event formats iCal dates in UTC', () => {
    const e = event({
      title: 'Launch',
      start: '2026-07-14T09:00:00Z',
      end: '2026-07-14T10:00:00Z',
    });
    expect(e).toContain('DTSTART:20260714T090000Z');
    expect(e).toContain('DTEND:20260714T100000Z');
    expect(e).toContain('SUMMARY:Launch');
  });

  it('crypto builds a BIP-21 URI with percent-encoded label', () => {
    expect(crypto({ address: '1abc', amount: 0.5 })).toBe('bitcoin:1abc?amount=0.5');
    expect(crypto({ coin: 'ethereum', address: '0xabc' })).toBe('ethereum:0xabc');
    expect(crypto({ address: '1abc', label: 'Coffee Shop' })).toBe(
      'bitcoin:1abc?label=Coffee%20Shop',
    );
  });
});
