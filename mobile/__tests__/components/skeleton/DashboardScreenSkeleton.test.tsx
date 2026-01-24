import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { DashboardScreenSkeleton } from '../../../src/components/skeleton/DashboardScreenSkeleton'

describe('DashboardScreenSkeleton', () => {
  it('renders skeleton container', () => {
    render(<DashboardScreenSkeleton testID="dashboard-skeleton" />)

    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy()
  })

  it('renders budget progress card skeleton', () => {
    render(<DashboardScreenSkeleton testID="dashboard-skeleton" />)

    expect(screen.getByTestId('dashboard-skeleton.budgetProgressCard')).toBeTruthy()
  })

  it('renders income stat card skeleton', () => {
    render(<DashboardScreenSkeleton testID="dashboard-skeleton" />)

    expect(screen.getByTestId('dashboard-skeleton.incomeCard')).toBeTruthy()
  })

  it('renders expense stat card skeleton', () => {
    render(<DashboardScreenSkeleton testID="dashboard-skeleton" />)

    expect(screen.getByTestId('dashboard-skeleton.expenseCard')).toBeTruthy()
  })

  it('renders Recent Transactions section title', () => {
    render(<DashboardScreenSkeleton testID="dashboard-skeleton" />)

    expect(screen.getByText('Recent Transactions')).toBeTruthy()
  })

  it('renders 5 transaction skeletons', () => {
    render(<DashboardScreenSkeleton testID="dashboard-skeleton" />)

    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`dashboard-skeleton.transaction.${i}`)).toBeTruthy()
    }
  })

  it('renders Loading month placeholder', () => {
    render(<DashboardScreenSkeleton testID="dashboard-skeleton" />)

    expect(screen.getByText('Loading...')).toBeTruthy()
  })

  it('renders without testID', () => {
    const { toJSON } = render(<DashboardScreenSkeleton />)

    expect(toJSON()).toBeTruthy()
  })
})
