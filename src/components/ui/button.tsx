import React from 'react'
import { cn } from '@/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-white/20 text-white hover:bg-white/30 focus-visible:ring-white/40',
  secondary:
    'border border-white/20 bg-white/15 text-white hover:border-white/30 hover:bg-white/25 focus-visible:ring-white/40',
  outline: 'border border-white/30 text-white hover:bg-white/15 focus-visible:ring-white/40',
  ghost: 'text-slate-200 hover:bg-white/10 focus-visible:ring-white/30',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:px-4 sm:py-2.5',
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {loading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        <span>{children}</span>
      </button>
    )
  },
)

Button.displayName = 'Button'
