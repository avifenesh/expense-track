'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { cn } from '@/utils/cn'

type Placement = 'top' | 'bottom' | 'left' | 'right'

export type InfoTooltipProps = {
  description: string
  label?: string
  placement?: Placement
  className?: string
}

const OPEN_DELAY_MS = 150
const CLOSE_DELAY_MS = 80

const placementClasses: Record<Placement, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
}

export function InfoTooltip({
  description,
  label = 'Learn more',
  placement = 'top',
  className,
}: InfoTooltipProps) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [resolvedPlacement, setResolvedPlacement] = useState<Placement>(placement)

  const clearTimers = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const handleOpen = () => {
    if (typeof window === 'undefined') {
      setOpen(true)
      return
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
    }
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true)
    }, OPEN_DELAY_MS)
  }

  const handleClose = (immediate = false) => {
    if (typeof window === 'undefined') {
      setOpen(false)
      return
    }
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (immediate) {
      setOpen(false)
      return
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, CLOSE_DELAY_MS)
  }

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setResolvedPlacement(placement)
      return
    }

    const updatePlacement = () => {
      const tooltipEl = tooltipRef.current
      if (!tooltipEl) {
        return
      }
      const rect = tooltipEl.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      setResolvedPlacement((current) => {
        let desired: Placement = placement
        if (placement === 'top' && rect.top < 0) {
          desired = 'bottom'
        } else if (placement === 'bottom' && rect.bottom > viewportHeight) {
          desired = 'top'
        } else if (placement === 'left' && rect.left < 0) {
          desired = 'right'
        } else if (placement === 'right' && rect.right > viewportWidth) {
          desired = 'left'
        }
        return desired === current ? current : desired
      })
    }

    updatePlacement()
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, true)

    return () => {
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  }, [open, placement])

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose(true)
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const triggerEl = triggerRef.current
      const tooltipEl = tooltipRef.current
      if (!triggerEl || !tooltipEl) {
        return
      }
      const target = event.target as Node
      if (!triggerEl.contains(target) && !tooltipEl.contains(target)) {
        handleClose(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={handleOpen}
        onBlur={() => handleClose(true)}
        onMouseEnter={handleOpen}
        onMouseLeave={() => handleClose()}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-200 transition',
          'hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
        )}
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={tooltipRef}
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-auto absolute z-50 max-w-xs rounded-md border border-white/10 bg-slate-950/95 px-3 py-2 text-left text-xs font-medium text-slate-100 shadow-xl backdrop-blur',
            placementClasses[resolvedPlacement],
          )}
          onMouseEnter={() => handleOpen()}
          onMouseLeave={() => handleClose()}
        >
          {description}
        </div>
      )}
    </span>
  )
}
