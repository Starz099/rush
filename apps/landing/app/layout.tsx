import type { Metadata } from 'next';
import './globals.css';
import { JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import Providers from './providers';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Rush: Agentic Video Editor',
  description: '',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        'dark',
        'h-full',
        'antialiased',
        'font-mono',
        jetbrainsMono.variable,
      )}
      style={{ colorScheme: 'dark' }}
    >
      <body className="relative flex min-h-full flex-col overflow-x-hidden">
        <div
          aria-hidden="true"
          className="noise-bg pointer-events-none absolute inset-0 z-0"
        />
        <Providers>
          <div className="relative z-10 flex flex-1 flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
