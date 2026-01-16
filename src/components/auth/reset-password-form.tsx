'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resetPasswordAction } from '@/app/actions'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'

const buttonBaseClasses =
  'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'
const primaryClasses = 'bg-white/20 text-white hover:bg-white/30 focus-visible:ring-white/40'

type ResetPasswordFormProps = {
  token: string
}

type FormErrors = Partial<Record<string, string[]>>

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errors, setErrors] = useState<FormErrors | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const newPassword = String(formData.get('newPassword') ?? '')

    setState('loading')
    setErrors(null)
    setMessage(null)

    const result = await resetPasswordAction({ token, newPassword })

    if ('error' in result) {
      setErrors(result.error)
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <label htmlFor="newPassword" className="text-xs font-medium uppercase tracking-wide text-slate-300">
          New password
        </label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          aria-describedby={errors?.newPassword ? 'newPassword-error' : undefined}
          autoComplete="new-password"
          required
          disabled={state === 'loading'}
        />
        {errors?.newPassword && (
          <p id="newPassword-error" className="text-xs text-rose-300">
            {errors.newPassword[0]}
          </p>
        )}
        <p className="text-xs text-slate-400">At least 8 characters with uppercase, lowercase, and a number.</p>
      </div>

      {errors?.token && (
        <div className="space-y-3">
          <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {errors.token[0]}
          </p>
          <Link href="/login" className="block text-center text-sm text-sky-300 hover:text-sky-200">
            Return to sign in to request a new reset link
          </Link>
        </div>
      )}

      {errors?.general && (
        <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {errors.general[0]}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'loading'}
        className={cn(buttonBaseClasses, primaryClasses, 'w-full', state === 'loading' && 'cursor-wait opacity-70')}
      >
        {state === 'loading' ? 'Resetting...' : 'Reset password'}
      </button>

      <p className="text-center text-xs text-slate-500">
        Remember your password?{' '}
        <Link href="/login" className="text-slate-300 underline hover:text-white">
          Sign in
        </Link>
      </p>
    </form>
  )
}
