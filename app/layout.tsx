import type { Metadata } from 'next';
import { Fira_Code, Geist, IM_Fell_English, MedievalSharp } from 'next/font/google';
import { type ReactNode } from 'react';
import MapLayout from 'src/components/MapLayout';
import { APP_NAME, siteMetadata } from 'src/configs/constance';
import { cn } from 'src/lib/utils';
import '../src/styles/globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const firaCode = Fira_Code({ subsets: ['latin'] });

const fellEnglish = IM_Fell_English({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-fell',
});

const medievalSharp = MedievalSharp({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-medieval',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteMetadata.url),
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: siteMetadata.description,
  applicationName: siteMetadata.siteName,
  keywords: siteMetadata.keywords,
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: siteMetadata.icon, sizes: 'any' },
    ],
  },
  openGraph: {
    title: siteMetadata.title,
    description: siteMetadata.description,
    url: siteMetadata.url,
    siteName: siteMetadata.siteName,
    type: 'website',
    images: [siteMetadata.image],
  },
  twitter: {
    card: 'summary_large_image',
    site: `@${siteMetadata.twitterHandle}`,
    title: siteMetadata.title,
    description: siteMetadata.description,
    images: [siteMetadata.image],
  },
};

interface TProps {
  children: ReactNode;
}

export default function RootLayout({ children }: TProps) {
  return (
    <html
      lang="en"
      className={cn('font-sans', geist.variable, fellEnglish.variable, medievalSharp.variable)}
    >
      <body className={cn('flex min-h-full flex-col antialiased', firaCode.className)}>
        <MapLayout>{children}</MapLayout>
      </body>
    </html>
  );
}
