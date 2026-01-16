import React from 'react'
import { cn } from '@/utils/cn'

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onChange, disabled, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <div
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
            'border-white/30 bg-white/10',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-sky-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950',
            checked && 'border-emerald-400 bg-emerald-400',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
          aria-hidden="true"
        >
          {checked && (
            <svg
              className="h-3 w-3 text-slate-900"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
    )
  },
)

Checkbox.displayName = 'Checkbox'
