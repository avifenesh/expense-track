'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteAccountAction } from '@/app/actions/auth'
import { useCsrfToken } from '@/hooks/useCsrfToken'

type DeleteAccountDialogProps = {
  userEmail: string
  onClose: () => void
}

export function DeleteAccountDialog({ userEmail, onClose }: DeleteAccountDialogProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()
  const [confirmEmail, setConfirmEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isEmailMatch = confirmEmail.toLowerCase() === userEmail.toLowerCase()

  const handleDelete = () => {
    if (!isEmailMatch) {
      setError('Email does not match your account')
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await deleteAccountAction({
        confirmEmail,
        csrfToken,
      })

      if ('error' in result && result.error) {
        const firstError = Object.values(result.error)[0]
        setError(Array.isArray(firstError) ? firstError[0] : 'Unable to delete account')
        return
      }

      // Account deleted - redirect to login
      router.push('/login?deleted=true')
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-rose-500/20 p-3">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
          </div>
        </div>

        <h2 className="mb-2 text-center text-xl font-semibold text-white">Delete Your Account</h2>
        <p className="mb-6 text-center text-sm text-slate-300">
          This action is <strong className="text-rose-400">permanent and irreversible</strong>. All your data including
          transactions, budgets, categories, and settings will be deleted immediately.
        </p>

        {/* Confirmation input */}
        <div className="mb-4">
          <label htmlFor="confirm-email" className="mb-2 block text-sm font-medium text-slate-300">
            Type <span className="font-mono text-rose-400">{userEmail}</span> to confirm
          </label>
          <Input
            id="confirm-email"
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Enter your email"
            className="border-rose-500/30 focus:border-rose-400 focus:ring-rose-400/40"
            autoComplete="off"
          />
        </div>

        {/* Error message */}
        {error && <div className="mb-4 rounded-lg bg-rose-500/20 px-3 py-2 text-sm text-rose-300">{error}</div>}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1 bg-rose-600 hover:bg-rose-700"
            onClick={handleDelete}
            disabled={!isEmailMatch || isPending}
            loading={isPending}
          >
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  )
}
