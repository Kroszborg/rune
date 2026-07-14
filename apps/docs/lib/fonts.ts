import { Libre_Caslon_Text, Manrope } from 'next/font/google';

export const display = Libre_Caslon_Text({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const sans = Manrope({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
