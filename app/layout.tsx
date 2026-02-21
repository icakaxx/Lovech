import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Дупките на Ловеч – Гражданска карта на пътните неравности',
  description:
    'Публична гражданска платформа за сигнализиране на дупки по пътищата в Ловеч. Сигналите стават видими след потвърждение по имейл.',
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
      </body>
    </html>
  );
}
