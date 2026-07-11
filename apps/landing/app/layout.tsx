import type { Metadata } from 'next';
import './globals.css';
import { Outfit } from 'next/font/google';
import { cn } from '@/lib/utils';
import Providers from './providers';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';
import DownloadModal from '@/components/download-modal';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'Rush: Agentic Video Editor',
  description: 'The AI-native agentic video editor for modern creators.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn('dark', 'h-full', 'antialiased', outfit.className)}
      style={{ colorScheme: 'dark' }}
      suppressHydrationWarning
    >
      <head>
        <meta name="darkreader-lock" />
      </head>
      <body className="bg-background text-foreground relative flex min-h-full flex-col overflow-x-hidden">
        <div
          aria-hidden="true"
          className="noise-bg pointer-events-none absolute inset-0 z-0"
        />
        <Providers>
          <Navbar />
          <div className="relative z-10 flex flex-1 flex-col">{children}</div>
          <Footer />
          <DownloadModal />
        </Providers>
      </body>
    </html>
  );
}
