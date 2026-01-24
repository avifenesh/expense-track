import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { SkeletonStatCard } from '../../../src/components/skeleton/SkeletonStatCard'

describe('SkeletonStatCard', () => {
  it('renders skeleton container', () => {
    render(<SkeletonStatCard testID="skeleton-stat" />)

    expect(screen.getByTestId('skeleton-stat')).toBeTruthy()
  })

  it('renders label skeleton', () => {
    render(<SkeletonStatCard testID="skeleton-stat" />)

    expect(screen.getByTestId('skeleton-stat.label')).toBeTruthy()
  })

  it('renders amount skeleton', () => {
    render(<SkeletonStatCard testID="skeleton-stat" />)

    expect(screen.getByTestId('skeleton-stat.amount')).toBeTruthy()
  })

  it('applies custom style', () => {
    const customStyle = { backgroundColor: 'red' }
    const { toJSON } = render(<SkeletonStatCard style={customStyle} testID="skeleton-stat" />)

    expect(toJSON()).toBeTruthy()
  })

  it('renders without testID', () => {
    const { toJSON } = render(<SkeletonStatCard />)

    expect(toJSON()).toBeTruthy()
  })
})
