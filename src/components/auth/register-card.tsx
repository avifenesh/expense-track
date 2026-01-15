'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { registerAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type FormErrors = Partial<Record<string, string[]>>

export function RegisterCard() {
  const [errors, setErrors] = useState<FormErrors | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      displayName: String(formData.get('displayName') ?? ''),
    }

    setErrors(null)
    setStatusMessage(null)

    startTransition(async () => {
      const result = await registerAction(payload)
      if ('error' in result) {
        setErrors(result.error)
        return
      }

      form.reset()
      setStatusMessage(result.data.message)
    })
  }

  return (
    <Card className="w-full max-w-md border-white/20 bg-white/10 text-slate-100 shadow-2xl backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
          Create account
        </div>
        <CardTitle className="text-2xl font-semibold text-white">Join Balance Beacon</CardTitle>
        <CardDescription className="text-slate-400">
          Create your account to start tracking your finances and managing your budget.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <label htmlFor="displayName" className="text-xs font-medium uppercase tracking-wide text-slate-300">
              Display name
            </label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              placeholder="Your name"
              aria-describedby={errors?.displayName ? 'displayName-error' : undefined}
              autoComplete="name"
              required
            />
            {errors?.displayName && (
              <p id="displayName-error" className="text-xs text-rose-300">
                {errors.displayName[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-slate-300">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              aria-describedby={errors?.email ? 'email-error' : undefined}
              autoComplete="email"
              required
            />
            {errors?.email && (
              <p id="email-error" className="text-xs text-rose-300">
                {errors.email[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-slate-300">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              aria-describedby={errors?.password ? 'password-error' : undefined}
              autoComplete="new-password"
              required
            />
            {errors?.password && (
              <p id="password-error" className="text-xs text-rose-300">
                {errors.password[0]}
              </p>
            )}
            <p className="text-xs text-slate-400">At least 8 characters with uppercase, lowercase, and a number.</p>
          </div>

          {errors?.general && (
            <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {errors.general[0]}
            </p>
          )}

          {statusMessage && (
            <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {statusMessage}
            </p>
          )}

          <Button type="submit" className="w-full" loading={isPending}>
            Create account
          </Button>
        </form>

        <div className="text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-sky-300 transition hover:text-sky-200">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
