import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { SkeletonTransactionItem } from '../../../src/components/skeleton/SkeletonTransactionItem'

describe('SkeletonTransactionItem', () => {
  it('renders skeleton container', () => {
    render(<SkeletonTransactionItem testID="skeleton-transaction" />)

    expect(screen.getByTestId('skeleton-transaction')).toBeTruthy()
  })

  it('renders category dot skeleton', () => {
    render(<SkeletonTransactionItem testID="skeleton-transaction" />)

    expect(screen.getByTestId('skeleton-transaction.categoryDot')).toBeTruthy()
  })

  it('renders description skeleton', () => {
    render(<SkeletonTransactionItem testID="skeleton-transaction" />)

    expect(screen.getByTestId('skeleton-transaction.description')).toBeTruthy()
  })

  it('renders date skeleton', () => {
    render(<SkeletonTransactionItem testID="skeleton-transaction" />)

    expect(screen.getByTestId('skeleton-transaction.date')).toBeTruthy()
  })

  it('renders amount skeleton', () => {
    render(<SkeletonTransactionItem testID="skeleton-transaction" />)

    expect(screen.getByTestId('skeleton-transaction.amount')).toBeTruthy()
  })

  it('renders without testID', () => {
    const { toJSON } = render(<SkeletonTransactionItem />)

    expect(toJSON()).toBeTruthy()
  })
})
