import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { SkeletonSharedExpenseCard } from '../../../src/components/skeleton/SkeletonSharedExpenseCard'

describe('SkeletonSharedExpenseCard', () => {
  it('renders skeleton container', () => {
    render(<SkeletonSharedExpenseCard testID="skeleton-shared" />)

    expect(screen.getByTestId('skeleton-shared')).toBeTruthy()
  })

  it('renders title skeleton', () => {
    render(<SkeletonSharedExpenseCard testID="skeleton-shared" />)

    expect(screen.getByTestId('skeleton-shared.title')).toBeTruthy()
  })

  it('renders status skeleton', () => {
    render(<SkeletonSharedExpenseCard testID="skeleton-shared" />)

    expect(screen.getByTestId('skeleton-shared.status')).toBeTruthy()
  })

  it('renders subtitle skeleton', () => {
    render(<SkeletonSharedExpenseCard testID="skeleton-shared" />)

    expect(screen.getByTestId('skeleton-shared.subtitle')).toBeTruthy()
  })

  it('renders category skeleton', () => {
    render(<SkeletonSharedExpenseCard testID="skeleton-shared" />)

    expect(screen.getByTestId('skeleton-shared.category')).toBeTruthy()
  })

  it('renders amount skeleton', () => {
    render(<SkeletonSharedExpenseCard testID="skeleton-shared" />)

    expect(screen.getByTestId('skeleton-shared.amount')).toBeTruthy()
  })

  it('renders without testID', () => {
    const { toJSON } = render(<SkeletonSharedExpenseCard />)

    expect(toJSON()).toBeTruthy()
  })
})
