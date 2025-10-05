import React from 'react'
import { ChevronDown } from 'lucide-react'
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
      <div className="group relative w-full">
        <select
          ref={ref}
          className={cn(
            'glass-select block w-full appearance-none rounded-lg border border-white/20 bg-white/10 px-3 py-2 pr-10 text-sm text-slate-100 shadow-inner shadow-slate-950/20 backdrop-blur focus:outline-none',
            'transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/40 focus:ring-offset-0 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400',
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
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 transition group-hover:text-sky-200 group-focus-within:text-sky-200" />
      </div>
    )
  },
)

Select.displayName = 'Select'
