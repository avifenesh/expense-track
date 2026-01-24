import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { TransactionsScreenSkeleton } from '../../../src/components/skeleton/TransactionsScreenSkeleton'

describe('TransactionsScreenSkeleton', () => {
  it('renders skeleton container', () => {
    render(<TransactionsScreenSkeleton testID="transactions-skeleton" />)

    expect(screen.getByTestId('transactions-skeleton')).toBeTruthy()
  })

  it('renders first section header skeleton', () => {
    render(<TransactionsScreenSkeleton testID="transactions-skeleton" />)

    expect(screen.getByTestId('transactions-skeleton.section.0.header')).toBeTruthy()
  })

  it('renders second section header skeleton', () => {
    render(<TransactionsScreenSkeleton testID="transactions-skeleton" />)

    expect(screen.getByTestId('transactions-skeleton.section.1.header')).toBeTruthy()
  })

  it('renders 3 transaction skeletons in first section', () => {
    render(<TransactionsScreenSkeleton testID="transactions-skeleton" />)

    for (let i = 0; i < 3; i++) {
      expect(screen.getByTestId(`transactions-skeleton.section.0.transaction.${i}`)).toBeTruthy()
    }
  })

  it('renders 3 transaction skeletons in second section', () => {
    render(<TransactionsScreenSkeleton testID="transactions-skeleton" />)

    for (let i = 0; i < 3; i++) {
      expect(screen.getByTestId(`transactions-skeleton.section.1.transaction.${i}`)).toBeTruthy()
    }
  })

  it('renders without testID', () => {
    const { toJSON } = render(<TransactionsScreenSkeleton />)

    expect(toJSON()).toBeTruthy()
  })
})
