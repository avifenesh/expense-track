import { Metadata } from 'next'
import Link from 'next/link'
import { verifyEmailAction } from '@/app/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/utils/cn'

export const metadata: Metadata = {
  title: 'Verify email · Balance Beacon',
  description: 'Verify your email address to activate your account.',
}

type VerifyEmailPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const buttonBaseClasses =
  'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'
const primaryClasses = 'bg-white/20 text-white hover:bg-white/30 focus-visible:ring-white/40'
const secondaryClasses =
  'border border-white/20 bg-white/15 text-white hover:border-white/30 hover:bg-white/25 focus-visible:ring-white/40'
const ghostClasses = 'text-slate-200 hover:bg-white/10 focus-visible:ring-white/30'

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const tokenParam = resolvedSearchParams.token
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam

  let result: { success: boolean; message: string } | null = null
  let error: string | null = null

  if (token) {
    const verifyResult = await verifyEmailAction({ token })
    if ('error' in verifyResult) {
      error = verifyResult.error.token?.[0] || verifyResult.error.general?.[0] || 'Verification failed'
    } else {
      result = { success: true, message: verifyResult.data.message }
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16 text-slate-100 sm:px-8">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_55%),_linear-gradient(145deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]"
        aria-hidden
      />

      <Card className="w-full max-w-md border-white/20 bg-white/10 text-slate-100 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
            <span
              className={`h-2 w-2 rounded-full ${result?.success ? 'bg-emerald-400' : error ? 'bg-rose-400' : 'bg-amber-400'}`}
              aria-hidden
            />
            Email verification
          </div>
          <CardTitle className="text-2xl font-semibold text-white">
            {result?.success ? 'Email verified!' : error ? 'Verification failed' : 'Verifying your email'}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {result?.success
              ? 'Your email has been verified successfully.'
              : error
                ? 'We could not verify your email address.'
                : 'Please wait while we verify your email address.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {result?.success && (
            <div className="space-y-4">
              <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {result.message}
              </p>
              <Link href="/login" className={cn(buttonBaseClasses, primaryClasses, 'w-full')}>
                Sign in to your account
              </Link>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
              <p className="text-sm text-slate-400">
                The verification link may have expired or already been used. Try registering again or contact support if
                the problem persists.
              </p>
              <div className="flex gap-3">
                <Link href="/register" className={cn(buttonBaseClasses, secondaryClasses, 'flex-1')}>
                  Register again
                </Link>
                <Link href="/login" className={cn(buttonBaseClasses, ghostClasses, 'flex-1')}>
                  Sign in
                </Link>
              </div>
            </div>
          )}

          {!token && (
            <div className="space-y-4">
              <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                No verification token provided. Please use the link from your verification email.
              </p>
              <Link href="/login" className={cn(buttonBaseClasses, primaryClasses, 'w-full')}>
                Go to sign in
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
