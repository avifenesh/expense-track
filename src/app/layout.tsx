import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ErrorBoundary } from '@/components/error-boundary'
import { ToastContainer } from '@/components/ui/toast-container'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Balance Beacon',
  description: 'Plan, track, and forecast shared finances across accounts.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Extract nonce from request headers
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`} nonce={nonce}>
        <ErrorBoundary>{children}</ErrorBoundary>
        <ToastContainer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
