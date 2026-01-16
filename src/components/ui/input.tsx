import React from 'react'
import { cn } from '@/utils/cn'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean
  valid?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, valid, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={ariaInvalid ?? (error ? 'true' : undefined)}
        className={cn(
          'block w-full rounded-lg border bg-white/10 px-3 py-2.5 text-sm text-slate-100 shadow-inner shadow-slate-950/20 backdrop-blur focus:outline-none sm:py-2',
          'placeholder:text-slate-400 transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400',
          error
            ? 'border-rose-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/40'
            : valid
              ? 'border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40'
              : 'border-white/20 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/40',
          className,
        )}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
