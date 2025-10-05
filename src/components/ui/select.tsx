import React from 'react'
import { cn } from '@/utils/cn'

export type SelectOption = {
  label: string
  value: string
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: SelectOption[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'block w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-slate-950/20 backdrop-blur focus:outline-none',
          'transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
    )
  },
)

Select.displayName = 'Select'
