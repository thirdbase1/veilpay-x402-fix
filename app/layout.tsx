import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Inter } from 'next/font/google'
import { siteConfig } from '@/lib/config'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: siteConfig.url ? new URL(siteConfig.url) : undefined,
  title: {
    default: 'VeilPay — Private payments. Public confidence.',
    template: '%s — VeilPay',
  },
  description:
    'VeilPay lets merchants verify payments without exposing more customer information than necessary. Built with privacy-preserving technology on Midnight.',
  applicationName: 'VeilPay',
  keywords: [
    'private payments',
    'zero-knowledge',
    'ZK verification',
    'Midnight network',
    'invoice',
    'privacy-preserving payments',
  ],
  authors: [{ name: 'VeilPay' }],
  openGraph: {
    type: 'website',
    title: 'VeilPay — Private payments. Public confidence.',
    description:
      'Verify payments without exposing more customer information than necessary. Built on Midnight.',
    siteName: 'VeilPay',
    ...(siteConfig.url ? { url: siteConfig.url } : {}),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VeilPay — Private payments. Public confidence.',
    description:
      'Verify payments without exposing more customer information than necessary. Built on Midnight.',
  },
  ...(siteConfig.url ? { alternates: { canonical: siteConfig.url } } : {}),
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#08090a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark bg-background ${inter.variable} ${geistMono.variable}`}
    >
      <body className="min-h-svh font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
