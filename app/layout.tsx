import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const themeBootstrapScript = `try{var k='graphcontract.workspace-theme';var v=localStorage.getItem(k);var t=v==='dark'||v==='signal'?v:'classic';if(v!==t)localStorage.setItem(k,t);document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t==='classic'?'light':'dark'}catch(e){document.documentElement.dataset.theme='classic';document.documentElement.style.colorScheme='light'}`;

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://graphcontract.dev'),
  title: 'GraphContract — Human-approved agent workflows',
  description:
    'Design agent workflows visually, review agent-proposed changes, and generate exhaustive execution-path contracts.',
  icons: {
    icon: '/favicon.svg',
  },
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
    <html lang="en" data-theme="classic" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
