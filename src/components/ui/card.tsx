import React from 'react'
import { cn } from '@/utils/cn'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import type { InfoTooltipProps } from '@/components/ui/info-tooltip'

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  helpText?: string
  helpLabel?: string
  helpPlacement?: InfoTooltipProps['placement']
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/15 bg-white/10 shadow-xl shadow-slate-950/40 backdrop-blur-lg',
        'transition duration-200 hover:border-white/25 hover:shadow-slate-950/60',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pt-5 pb-3 text-sm text-slate-200', className)} {...props} />
}

export function CardTitle({
  className,
  children,
  helpText,
  helpLabel,
  helpPlacement = 'top',
  ...props
}: CardTitleProps) {
  const label = helpLabel ?? (typeof children === 'string' ? `Learn more about ${children}` : 'Learn more about this card')

  return (
    <h3
      className={cn(
        'text-base font-semibold text-white',
        helpText && 'flex items-start gap-2',
        className,
      )}
      {...props}
    >
      <span className="flex-1 leading-tight">{children}</span>
      {helpText ? (
        <InfoTooltip description={helpText} label={label} placement={helpPlacement} />
      ) : null}
    </h3>
  )
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5 text-sm text-slate-200', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5 text-sm text-slate-200', className)} {...props} />
}
