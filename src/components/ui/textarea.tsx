import React from 'react'
import { cn } from '@/utils/cn'

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'block w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-slate-950/20 backdrop-blur focus:outline-none',
          'placeholder:text-slate-400 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400',
          className,
        )}
        {...props}
      />
    )
  },
)

Textarea.displayName = 'Textarea'
