import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://signalilovech.com'),
  title: 'SignalILovech.com – карта на сигналите в Община Ловеч',
  description: 'Подай сигнал за проблем по пътя за 30 секунди (снимка + място). Виж всички сигнали на карта.',
  verification: {
    google: 'Xjz-FQa2dVvQcSlMyMGmRPRxq5KKULw0TCK7alj0b5c',
  },
  openGraph: {
    title: 'SignalILovech.com – карта на сигналите в Община Ловеч',
    description: 'Подай сигнал за проблем по пътя за 30 секунди (снимка + място). Виж всички сигнали на карта.',
    url: 'https://signalilovech.com',
    siteName: 'Сигнали Ловеч',
    locale: 'bg_BG',
    type: 'website',
    images: [
      {
        url: 'https://signalilovech.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SignalILovech.com – карта на сигналите в Община Ловеч',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SignalILovech.com – карта на сигналите в Община Ловеч',
    description: 'Подай сигнал за проблем по пътя за 30 секунди (снимка + място). Виж всички сигнали на карта.',
    images: ['https://signalilovech.com/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bg" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-slate-100 text-slate-900" suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
