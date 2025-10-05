import { memo, useMemo } from 'react'
import { cn } from '@/utils/cn'

type SparklineProps = {
  values: number[]
  width?: number
  height?: number
  className?: string
  strokeClassName?: string
  fillClassName?: string
  ariaLabel?: string
}

function computePaths(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return { line: '', area: '' }
  }

  if (values.length === 1) {
    const midX = width / 2
    const midY = height / 2
    const line = `M ${midX} ${midY} L ${midX} ${midY}`
    const area = `M ${midX} ${midY} L ${midX} ${height} L 0 ${height} Z`
    return { line, area }
  }

  const padding = 4
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2

  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 0)
  const range = maxValue - minValue || 1
  const step = usableWidth / (values.length - 1)

  const getY = (value: number) => padding + ((maxValue - value) / range) * usableHeight

  let linePath = ''
  values.forEach((value, index) => {
    const x = padding + step * index
    const y = getY(value)
    linePath += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`
  })

  const firstX = padding
  const lastX = padding + step * (values.length - 1)
  const baselineY = getY(0)
  const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`

  return { line: linePath, area: areaPath }
}

function SparklineComponent({
  values,
  width = 200,
  height = 60,
  className,
  strokeClassName,
  fillClassName = 'fill-blue-500/20',
  ariaLabel = 'Net cashflow trend',
}: SparklineProps) {
  const { line, area } = useMemo(() => computePaths(values, width, height), [values, width, height])

  return (
    <svg
      className={cn('h-full w-full overflow-visible', className)}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {area && <path d={area} className={fillClassName} />}
      {line && (
        <path
          d={line}
          className={cn('fill-none stroke-blue-500', strokeClassName)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
        />
      )}
    </svg>
  )
}

export const Sparkline = memo(SparklineComponent)
