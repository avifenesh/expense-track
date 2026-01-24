import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { SkeletonBudgetProgressCard } from '../../../src/components/skeleton/SkeletonBudgetProgressCard'

describe('SkeletonBudgetProgressCard', () => {
  it('renders skeleton container', () => {
    render(<SkeletonBudgetProgressCard testID="skeleton-budget-progress" />)

    expect(screen.getByTestId('skeleton-budget-progress')).toBeTruthy()
  })

  it('renders label skeleton', () => {
    render(<SkeletonBudgetProgressCard testID="skeleton-budget-progress" />)

    expect(screen.getByTestId('skeleton-budget-progress.label')).toBeTruthy()
  })

  it('renders spent amount skeleton', () => {
    render(<SkeletonBudgetProgressCard testID="skeleton-budget-progress" />)

    expect(screen.getByTestId('skeleton-budget-progress.spent')).toBeTruthy()
  })

  it('renders budget text skeleton', () => {
    render(<SkeletonBudgetProgressCard testID="skeleton-budget-progress" />)

    expect(screen.getByTestId('skeleton-budget-progress.budgetText')).toBeTruthy()
  })

  it('renders progress bar skeleton', () => {
    render(<SkeletonBudgetProgressCard testID="skeleton-budget-progress" />)

    expect(screen.getByTestId('skeleton-budget-progress.progress')).toBeTruthy()
  })

  it('renders remaining text skeleton', () => {
    render(<SkeletonBudgetProgressCard testID="skeleton-budget-progress" />)

    expect(screen.getByTestId('skeleton-budget-progress.remaining')).toBeTruthy()
  })

  it('renders without testID', () => {
    const { toJSON } = render(<SkeletonBudgetProgressCard />)

    expect(toJSON()).toBeTruthy()
  })
})
