'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { loginAction, requestPasswordResetAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/utils/cn'

export type LoginAccountOption = {
  id: string
  name: string
}

type LoginCardProps = {
  accounts: LoginAccountOption[]
}

type FormErrors = Partial<Record<string, string[]>>

type Mode = 'login' | 'reset'

export function LoginCard({ accounts }: LoginCardProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [errors, setErrors] = useState<FormErrors | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const defaultAccountId = useMemo(() => accounts[0]?.id ?? '', [accounts])

  const handleLoginSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      username: String(formData.get('username') ?? ''),
      password: String(formData.get('password') ?? ''),
      accountId: String(formData.get('accountId') ?? defaultAccountId),
    }

    setErrors(null)
    setStatusMessage(null)

    startTransition(async () => {
      const result = await loginAction(payload)
      if (result?.error) {
        setErrors(result.error)
        return
      }

      router.push(`/?account=${result?.accountId ?? payload.accountId}`)
      router.refresh()
    })
  }

  const handleResetSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      email: String(formData.get('email') ?? ''),
    }

    setErrors(null)
    setStatusMessage(null)

    startTransition(async () => {
      const result = await requestPasswordResetAction(payload)
      if (result?.error) {
        setErrors(result.error)
        return
      }
      form.reset()
      setStatusMessage(result?.message ?? 'Reset instructions were sent to your inbox.')
    })
  }

  const switchMode = (nextMode: Mode) => {
    setErrors(null)
    setStatusMessage(null)
    setMode(nextMode)
  }

  return (
    <Card className="w-full max-w-md border-white/20 bg-white/10 text-slate-100 shadow-2xl backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
          Secure access
        </div>
        <CardTitle className="text-2xl font-semibold text-white">
          {mode === 'login' ? 'Resume your financial workspace' : 'Restore sign-in access'}
        </CardTitle>
        <p className="text-sm text-slate-300">
          {mode === 'login'
            ? 'Use the shared steward credentials to unlock dashboards and focus on the account that needs attention.'
            : 'We will verify one of the trusted recovery inboxes and email the stewardship guide with the standard password.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex rounded-full bg-slate-900/30 p-1 text-xs font-medium text-slate-300">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={cn(
              'flex-1 rounded-full px-4 py-1.5 transition',
              mode === 'login' ? 'bg-white/20 text-white shadow' : 'hover:bg-white/10',
            )}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('reset')}
            className={cn(
              'flex-1 rounded-full px-4 py-1.5 transition',
              mode === 'reset' ? 'bg-white/20 text-white shadow' : 'hover:bg-white/10',
            )}
          >
            Forgot password
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="off" noValidate>
            <div className="space-y-2">
              <label htmlFor="username" className="text-xs font-medium uppercase tracking-wide text-slate-300">
                Username
              </label>
              <Input
                id="username"
                name="username"
                placeholder="balance-director"
                aria-describedby={errors?.username ? 'username-error' : undefined}
                autoComplete="username"
                required
              />
              {errors?.username && (
                <p id="username-error" className="text-xs text-rose-300">
                  {errors.username[0]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-xs font-medium text-sky-300 transition hover:text-sky-200"
                >
                  Need a reset?
                </button>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Balance2025!"
                aria-describedby={errors?.password ? 'password-error' : errors?.credentials ? 'credentials-error' : undefined}
                autoComplete="current-password"
                required
              />
              {errors?.password && (
                <p id="password-error" className="text-xs text-rose-300">
                  {errors.password[0]}
                </p>
              )}
              {errors?.credentials && (
                <p id="credentials-error" className="text-xs text-rose-300">
                  {errors.credentials[0]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="accountId" className="text-xs font-medium uppercase tracking-wide text-slate-300">
                Work on account
              </label>
              <Select
                id="accountId"
                name="accountId"
                defaultValue={defaultAccountId}
                options={accounts.map((account) => ({ label: account.name, value: account.id }))}
                aria-describedby={errors?.accountId ? 'account-error' : undefined}
                disabled={accounts.length === 0}
              >
                {accounts.length === 0 && <option value="">No accounts available</option>}
              </Select>
              {errors?.accountId && (
                <p id="account-error" className="text-xs text-rose-300">
                  {errors.accountId[0]}
                </p>
              )}
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
              Enter Balance Beacon
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-slate-300">
                Recovery email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="director@balancebeacon.app"
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

            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
              We send a checklist that confirms your identity, reiterates the shared password, and explains next steps for
              the team ledger.
            </p>

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

            <div className="flex gap-3">
              <Button type="submit" className="flex-1" loading={isPending}>
                Email instructions
              </Button>
              <Button type="button" variant="ghost" className="flex-1" onClick={() => switchMode('login')}>
                Back to sign in
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
