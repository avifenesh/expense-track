'use client'

import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToastMessage } from '@/lib/toast-events'

type ToastProps = ToastMessage & {
  onDismiss: () => void
}

const variantConfig = {
  success: {
    icon: CheckCircle,
    className: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
    iconClassName: 'text-emerald-400',
    ariaLive: 'polite' as const,
  },
  error: {
    icon: XCircle,
    className: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
    iconClassName: 'text-rose-400',
    ariaLive: 'assertive' as const,
  },
  info: {
    icon: Info,
    className: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
    iconClassName: 'text-sky-400',
    ariaLive: 'polite' as const,
  },
} as const

export function Toast({ type, message, onDismiss }: ToastProps) {
  const config = variantConfig[type]
  const Icon = config.icon

  return (
    <div
      role="status"
      aria-live={config.ariaLive}
      className={cn(
        // Base styles
        'rounded-xl border backdrop-blur-lg shadow-xl',
        'px-4 py-3 flex items-center gap-3',
        'min-w-[300px] max-w-md',
        // Animation
        'animate-slide-in',
        // Variant-specific styles
        config.className
      )}
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0', config.iconClassName)} aria-hidden="true" />

      <p className="text-sm font-medium flex-1">{message}</p>

      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          'flex-shrink-0 rounded-lg p-1',
          'hover:bg-white/10 focus-visible:bg-white/10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
          'transition-colors'
        )}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
