import React from 'react'
import { cn } from '@/utils/cn'

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

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold text-white', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5 text-sm text-slate-200', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5 text-sm text-slate-200', className)} {...props} />
}
