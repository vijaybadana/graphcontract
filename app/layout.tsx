import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://graphcontract.vijaybadana.chatgpt.site'),
  title: 'GraphContract — Human-approved agent workflows',
  description:
    'Design agent workflows visually, review agent-proposed changes, and generate exhaustive execution-path contracts.',
  openGraph: {
    title: 'GraphContract',
    description: 'Human-approved agent workflows',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GraphContract',
    description: 'Human-approved agent workflows',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
