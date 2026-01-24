import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { BudgetsScreenSkeleton } from '../../../src/components/skeleton/BudgetsScreenSkeleton'

describe('BudgetsScreenSkeleton', () => {
  it('renders skeleton container', () => {
    render(<BudgetsScreenSkeleton testID="budgets-skeleton" />)

    expect(screen.getByTestId('budgets-skeleton')).toBeTruthy()
  })

  it('renders budget progress card skeleton', () => {
    render(<BudgetsScreenSkeleton testID="budgets-skeleton" />)

    expect(screen.getByTestId('budgets-skeleton.budgetProgressCard')).toBeTruthy()
  })

  it('renders Category Budgets section title', () => {
    render(<BudgetsScreenSkeleton testID="budgets-skeleton" />)

    expect(screen.getByText('Category Budgets')).toBeTruthy()
  })

  it('renders 4 category card skeletons', () => {
    render(<BudgetsScreenSkeleton testID="budgets-skeleton" />)

    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`budgets-skeleton.categoryCard.${i}`)).toBeTruthy()
    }
  })

  it('renders Loading month placeholder', () => {
    render(<BudgetsScreenSkeleton testID="budgets-skeleton" />)

    expect(screen.getByText('Loading...')).toBeTruthy()
  })

  it('renders without testID', () => {
    const { toJSON } = render(<BudgetsScreenSkeleton />)

    expect(toJSON()).toBeTruthy()
  })
})
