'use client'

import { useState } from 'react'
import Link from 'next/link'
import { verifyEmailAction } from '@/app/actions'
import { cn } from '@/utils/cn'

const buttonBaseClasses =
  'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'
const primaryClasses = 'bg-white/20 text-white hover:bg-white/30 focus-visible:ring-white/40'
const secondaryClasses =
  'border border-white/20 bg-white/15 text-white hover:border-white/30 hover:bg-white/25 focus-visible:ring-white/40'
const ghostClasses = 'text-slate-200 hover:bg-white/10 focus-visible:ring-white/30'

type VerifyEmailFormProps = {
  token: string
}

export function VerifyEmailForm({ token }: VerifyEmailFormProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleVerify() {
    setState('loading')
    const result = await verifyEmailAction({ token })

    if ('error' in result) {
      const errorMessage = result.error.token?.[0] || result.error.general?.[0] || 'Verification failed'
      setMessage(errorMessage)
      setState('error')
    } else {
      setMessage(result.data.message)
      setState('success')
    }
  }

  if (state === 'success') {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
        <Link href="/login" className={cn(buttonBaseClasses, primaryClasses, 'w-full')}>
          Sign in to your account
        </Link>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{message}</p>
        <p className="text-sm text-slate-400">
          The verification link may have expired or already been used. Try requesting a new verification email or
          contact support if the problem persists.
        </p>
        <div className="flex gap-3">
          <Link href="/login" className={cn(buttonBaseClasses, secondaryClasses, 'flex-1')}>
            Sign in
          </Link>
          <Link href="/register" className={cn(buttonBaseClasses, ghostClasses, 'flex-1')}>
            Register again
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300">
        Click the button below to verify your email address and activate your account.
      </p>
      <button
        onClick={handleVerify}
        disabled={state === 'loading'}
        className={cn(buttonBaseClasses, primaryClasses, 'w-full', state === 'loading' && 'cursor-wait opacity-70')}
      >
        {state === 'loading' ? 'Verifying...' : 'Verify my email'}
      </button>
      <p className="text-center text-xs text-slate-500">
        Having trouble?{' '}
        <Link href="/login" className="text-slate-300 underline hover:text-white">
          Try signing in
        </Link>
      </p>
    </div>
  )
}
