import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'দোকান সামলাও! — Dokaan Shamlao | Bangladeshi Shopkeeping Game',
  description:
    'দোকান সামলাও! (Dokaan Shamlao) — পাড়ার মুদি দোকান সামলানোর মজার আর্কেড গেম, সৌজন্যে HelloKhata (Maple Service Solution Limited)।',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'দোকান সামলাও!',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#C9462C',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
