import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://signalilovech.com'),
  title: 'Сигнали Ловеч – Гражданска карта на пътните неравности',
  description: 'Подай сигнал за дупка на пътя в Ловеч. Виж карта с всички граждански сигнали.',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  openGraph: {
    title: 'Сигнали Ловеч – Гражданска карта на пътните неравности',
    description: 'Подай сигнал за дупка на пътя в Ловеч. Виж карта с всички граждански сигнали.',
    url: 'https://signalilovech.com',
    siteName: 'Сигнали Ловеч',
    locale: 'bg_BG',
    type: 'website',
    images: [
      {
        url: 'https://signalilovech.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Сигнали Ловеч – Гражданска карта на пътните неравности',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Сигнали Ловеч – Гражданска карта на пътните неравности',
    description: 'Подай сигнал за дупка на пътя в Ловеч. Виж карта с всички граждански сигнали.',
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
