import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { SkeletonBudgetCategoryCard } from '../../../src/components/skeleton/SkeletonBudgetCategoryCard'

describe('SkeletonBudgetCategoryCard', () => {
  it('renders skeleton container', () => {
    render(<SkeletonBudgetCategoryCard testID="skeleton-category" />)

    expect(screen.getByTestId('skeleton-category')).toBeTruthy()
  })

  it('renders category dot skeleton', () => {
    render(<SkeletonBudgetCategoryCard testID="skeleton-category" />)

    expect(screen.getByTestId('skeleton-category.categoryDot')).toBeTruthy()
  })

  it('renders category name skeleton', () => {
    render(<SkeletonBudgetCategoryCard testID="skeleton-category" />)

    expect(screen.getByTestId('skeleton-category.categoryName')).toBeTruthy()
  })

  it('renders amounts skeleton', () => {
    render(<SkeletonBudgetCategoryCard testID="skeleton-category" />)

    expect(screen.getByTestId('skeleton-category.amounts')).toBeTruthy()
  })

  it('renders progress bar skeleton', () => {
    render(<SkeletonBudgetCategoryCard testID="skeleton-category" />)

    expect(screen.getByTestId('skeleton-category.progress')).toBeTruthy()
  })

  it('renders without testID', () => {
    const { toJSON } = render(<SkeletonBudgetCategoryCard />)

    expect(toJSON()).toBeTruthy()
  })
})
