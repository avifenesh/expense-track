'use client'

import { Button } from '@/components/ui/button'

type SampleDataStepProps = {
  onSubmit: (addSampleData: boolean) => void
  onBack: () => void
  isPending: boolean
}

export function SampleDataStep({ onSubmit, onBack, isPending }: SampleDataStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4 text-sm text-slate-300">
        <p>Would you like us to add some sample transactions and budgets to see how Balance Beacon works?</p>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="font-medium text-white">Sample data includes:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-400">
            <li>Default expense and income categories</li>
            <li>A sample grocery expense transaction</li>
            <li>A sample salary income transaction</li>
            <li>A sample monthly budget for groceries</li>
          </ul>
        </div>

        <p className="text-xs text-slate-400">
          You can delete or modify any sample data after setup. This is just to help you understand the app.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onBack} variant="outline" disabled={isPending}>
          Back
        </Button>
        <Button onClick={() => onSubmit(true)} className="flex-1" disabled={isPending} loading={isPending}>
          Yes, add sample data
        </Button>
        <Button onClick={() => onSubmit(false)} variant="secondary" disabled={isPending}>
          No, start fresh
        </Button>
      </div>
    </div>
  )
}
