import React from 'react'
import { cn } from '@/utils/cn'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'block w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-slate-950/20 backdrop-blur focus:outline-none',
        'placeholder:text-slate-400 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400',
        className,
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'
