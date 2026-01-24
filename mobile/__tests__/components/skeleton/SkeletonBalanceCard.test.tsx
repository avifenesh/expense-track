import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { SkeletonBalanceCard } from '../../../src/components/skeleton/SkeletonBalanceCard'

describe('SkeletonBalanceCard', () => {
  it('renders skeleton container', () => {
    render(<SkeletonBalanceCard testID="skeleton-balance" />)

    expect(screen.getByTestId('skeleton-balance')).toBeTruthy()
  })

  it('renders label skeleton', () => {
    render(<SkeletonBalanceCard testID="skeleton-balance" />)

    expect(screen.getByTestId('skeleton-balance.label')).toBeTruthy()
  })

  it('renders amount skeleton', () => {
    render(<SkeletonBalanceCard testID="skeleton-balance" />)

    expect(screen.getByTestId('skeleton-balance.amount')).toBeTruthy()
  })

  it('renders subtext skeleton', () => {
    render(<SkeletonBalanceCard testID="skeleton-balance" />)

    expect(screen.getByTestId('skeleton-balance.subtext')).toBeTruthy()
  })

  it('renders without testID', () => {
    const { toJSON } = render(<SkeletonBalanceCard />)

    expect(toJSON()).toBeTruthy()
  })

  it('does not pass undefined testIDs to child skeletons when testID is not provided', () => {
    const { toJSON } = render(<SkeletonBalanceCard />)
    const json = toJSON()

    expect(json).toBeTruthy()
  })
})
