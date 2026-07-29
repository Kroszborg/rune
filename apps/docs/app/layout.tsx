import './globals.css';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { display, sans } from '@/lib/fonts';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rune - lightweight, fully customizable QR codes',
  description:
    'Framework-agnostic QR code library. Pure SVG, zero dependencies, built from scratch per ISO/IEC 18004. React, Vue, and vanilla. Gradients, custom shapes, logos, frames, and PNG/PDF export.',
  metadataBase: new URL('https://rune.kroszborg.co'),
  openGraph: { title: 'Rune - customizable QR codes', type: 'website' },
};

// Set the theme before paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: inline no-flash theme setter. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="relative z-10 flex min-h-screen flex-col">
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
