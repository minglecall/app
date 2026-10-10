import type { Metadata } from 'next';
import '../src/index.css';

export const metadata: Metadata = {
  title: 'LiveCall - 1-on-1 Video & Monetization',
  description: 'Live 1-on-1 video calling, creator monetization, interactive matching, and discovery platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#09090C" />
      </head>
      <body>{children}</body>
    </html>
  );
}
