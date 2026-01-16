'use client'

import { useState, useTransition } from 'react'
import { Download, X, FileJson, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportUserDataAction } from '@/app/actions/auth'
import { useCsrfToken } from '@/hooks/useCsrfToken'

type ExportFormat = 'json' | 'csv'

type ExportDataDialogProps = {
  onClose: () => void
}

export function ExportDataDialog({ onClose }: ExportDataDialogProps) {
  const csrfToken = useCsrfToken()
  const [format, setFormat] = useState<ExportFormat>('json')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleExport = () => {
    setError(null)
    startTransition(async () => {
      const result = await exportUserDataAction({
        format,
        csrfToken,
      })

      if ('error' in result && result.error) {
        const firstError = Object.values(result.error)[0]
        setError(Array.isArray(firstError) ? firstError[0] : 'Unable to export data')
        return
      }

      if ('data' in result && result.data) {
        const exportResult = result.data
        const content = exportResult.format === 'json' ? JSON.stringify(exportResult.data, null, 2) : exportResult.data
        const mimeType = exportResult.format === 'json' ? 'application/json' : 'text/csv'
        const extension = exportResult.format

        const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `balance-beacon-export-${new Date().toISOString().split('T')[0]}.${extension}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        onClose()
      }
    })
  }

  const isLoading = !csrfToken

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="relative mx-4 w-full max-w-md rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-emerald-500/20 p-3">
            <Download className="h-8 w-8 text-emerald-400" />
          </div>
        </div>

        <h2 id="export-dialog-title" className="mb-2 text-center text-xl font-semibold text-white">
          Export Your Data
        </h2>
        <p className="mb-6 text-center text-sm text-slate-300">
          Download all your data including transactions, budgets, categories, and more. This helps you maintain control
          of your information (GDPR Article 20).
        </p>

        {/* Format selection */}
        <div className="mb-6">
          <label className="mb-3 block text-sm font-medium text-slate-300">Choose export format</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFormat('json')}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                format === 'json'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              <FileJson className="h-8 w-8" />
              <span className="text-sm font-medium">JSON</span>
              <span className="text-xs text-slate-500">Structured data format</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat('csv')}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                format === 'csv'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              <FileText className="h-8 w-8" />
              <span className="text-sm font-medium">CSV</span>
              <span className="text-xs text-slate-500">Spreadsheet compatible</span>
            </button>
          </div>
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
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleExport}
            disabled={isPending || isLoading}
            loading={isPending || isLoading}
            title={isLoading ? 'Loading security token...' : undefined}
          >
            {isLoading ? 'Loading...' : `Export as ${format.toUpperCase()}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
