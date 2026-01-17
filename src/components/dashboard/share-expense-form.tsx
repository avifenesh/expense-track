'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Currency, SplitType } from '@prisma/client'
import { Plus, Trash2, Users } from 'lucide-react'
import { shareExpenseAction, lookupUserForSharingAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/utils/format'
import { toast } from '@/hooks/useToast'
import { useCsrfToken } from '@/hooks/useCsrfToken'

type Participant = {
  email: string
  displayName?: string
  shareAmount?: number
  sharePercentage?: number
  verified: boolean
}

type FormErrors = Partial<Record<string, string[]>>

export type ShareExpenseFormProps = {
  transactionId: string
  transactionAmount: number
  transactionDescription: string | null
  currency: Currency
  onClose: () => void
}

const splitTypeOptions = [
  { label: 'Split equally', value: SplitType.EQUAL },
  { label: 'By percentage', value: SplitType.PERCENTAGE },
  { label: 'Fixed amounts', value: SplitType.FIXED },
]

export function ShareExpenseForm({
  transactionId,
  transactionAmount,
  transactionDescription,
  currency,
  onClose,
}: ShareExpenseFormProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()

  const [splitType, setSplitType] = useState<SplitType>(SplitType.EQUAL)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [description, setDescription] = useState(transactionDescription || '')
  const [isPending, startTransition] = useTransition()
  const [isLookingUp, startLookup] = useTransition()
  const [formErrors, setFormErrors] = useState<FormErrors | null>(null)

  const handleAddParticipant = () => {
    if (!newEmail.trim()) return

    const email = newEmail.trim().toLowerCase()

    if (participants.some((p) => p.email.toLowerCase() === email)) {
      toast.error('This person is already added')
      return
    }

    startLookup(async () => {
      const result = await lookupUserForSharingAction({ email, csrfToken })

      if ('error' in result) {
        const errorMessage = result.error.general?.[0] || 'User not found'
        toast.error(errorMessage)
        return
      }

      setParticipants((prev) => [
        ...prev,
        {
          email: result.data.user.email,
          displayName: result.data.user.displayName,
          verified: true,
        },
      ])
      setNewEmail('')
    })
  }

  const handleRemoveParticipant = (email: string) => {
    setParticipants((prev) => prev.filter((p) => p.email !== email))
  }

  const handleParticipantShareChange = (email: string, field: 'shareAmount' | 'sharePercentage', value: string) => {
    const numValue = parseFloat(value) || 0
    setParticipants((prev) => prev.map((p) => (p.email === email ? { ...p, [field]: numValue } : p)))
  }

  const calculateShares = () => {
    const numParticipants = participants.length + 1 // +1 for the owner
    switch (splitType) {
      case SplitType.EQUAL: {
        const perPersonShare = transactionAmount / numParticipants
        return Math.round(perPersonShare * participants.length * 100) / 100
      }
      case SplitType.PERCENTAGE: {
        const totalPercentage = participants.reduce((sum, p) => sum + (p.sharePercentage || 0), 0)
        return Math.round(transactionAmount * (totalPercentage / 100) * 100) / 100
      }
      case SplitType.FIXED:
        return participants.reduce((sum, p) => sum + (p.shareAmount || 0), 0)
    }
  }

  const ownerShare = () => {
    const participantTotal = calculateShares()
    return Math.round((transactionAmount - participantTotal) * 100) / 100
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors(null)

    if (participants.length === 0) {
      setFormErrors({ participants: ['Add at least one person to share with'] })
      return
    }

    const participantData = participants.map((p) => ({
      email: p.email,
      shareAmount: splitType === SplitType.FIXED ? p.shareAmount : undefined,
      sharePercentage: splitType === SplitType.PERCENTAGE ? p.sharePercentage : undefined,
    }))

    startTransition(async () => {
      const result = await shareExpenseAction({
        transactionId,
        splitType,
        participants: participantData,
        description: description || null,
        csrfToken,
      })

      if ('error' in result) {
        const serverErrors = result.error as FormErrors
        setFormErrors(serverErrors)
        toast.error('Unable to share expense.')
        return
      }

      toast.success('Expense shared successfully')
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - disable interactions while submitting */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isPending ? onClose : undefined}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/20 bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-sky-500/20 p-2">
            <Users className="h-5 w-5 text-sky-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Share Expense</h2>
            <p className="text-sm text-slate-400">
              {formatCurrency(transactionAmount, currency)} - {transactionDescription || 'No description'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formErrors?.general && <p className="text-sm text-rose-300">{formErrors.general[0]}</p>}

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Split type</label>
            <Select
              value={splitType}
              onChange={(e) => setSplitType(e.target.value as SplitType)}
              options={splitTypeOptions}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Add participants</label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddParticipant()
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddParticipant}
                disabled={!newEmail.trim() || isLookingUp}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formErrors?.participants && <p className="text-xs text-rose-300">{formErrors.participants[0]}</p>}
          </div>

          {participants.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Participants</label>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.email}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{participant.displayName || participant.email}</p>
                      {participant.displayName && <p className="text-xs text-slate-400">{participant.email}</p>}
                    </div>

                    {splitType === SplitType.PERCENTAGE && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="w-20"
                          placeholder="0"
                          value={participant.sharePercentage || ''}
                          onChange={(e) =>
                            handleParticipantShareChange(participant.email, 'sharePercentage', e.target.value)
                          }
                        />
                        <span className="text-sm text-slate-400">%</span>
                      </div>
                    )}

                    {splitType === SplitType.FIXED && (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-slate-400">{currency}</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24"
                          placeholder="0.00"
                          value={participant.shareAmount || ''}
                          onChange={(e) =>
                            handleParticipantShareChange(participant.email, 'shareAmount', e.target.value)
                          }
                        />
                      </div>
                    )}

                    {splitType === SplitType.EQUAL && (
                      <span className="text-sm text-slate-300">
                        {formatCurrency(transactionAmount / (participants.length + 1), currency)}
                      </span>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/20"
                      onClick={() => handleRemoveParticipant(participant.email)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {participants.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Your share:</span>
                <span className="font-medium text-white">{formatCurrency(ownerShare(), currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Others pay:</span>
                <span className="font-medium text-white">{formatCurrency(calculateShares(), currency)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Note (optional)</label>
            <Textarea
              placeholder="Add a note for participants..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isPending} disabled={participants.length === 0 || isPending}>
              Share expense
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
