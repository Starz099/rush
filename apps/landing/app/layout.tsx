import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en" className={`h-full antialiased`}>
      <body
        className="relative flex min-h-full flex-col overflow-x-hidden"
        suppressHydrationWarning={true}
      >
        <div
          aria-hidden="true"
          className="noise-bg pointer-events-none absolute inset-0 z-0"
        />
        <div className="relative z-10 flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
