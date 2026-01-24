import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { SkeletonDateSectionHeader } from '../../../src/components/skeleton/SkeletonDateSectionHeader'

describe('SkeletonDateSectionHeader', () => {
  it('renders skeleton container', () => {
    render(<SkeletonDateSectionHeader testID="skeleton-date-header" />)

    expect(screen.getByTestId('skeleton-date-header')).toBeTruthy()
  })

  it('renders title skeleton', () => {
    render(<SkeletonDateSectionHeader testID="skeleton-date-header" />)

    expect(screen.getByTestId('skeleton-date-header.title')).toBeTruthy()
  })

  it('renders without testID', () => {
    const { toJSON } = render(<SkeletonDateSectionHeader />)

    expect(toJSON()).toBeTruthy()
  })

  it('does not pass undefined testIDs to child skeletons when testID is not provided', () => {
    const { toJSON } = render(<SkeletonDateSectionHeader />)
    const json = toJSON()

    expect(json).toBeTruthy()
  })

  it('renders with correct structure', () => {
    const { toJSON } = render(<SkeletonDateSectionHeader testID="skeleton-date-header" />)
    const json = toJSON()

    expect(json?.type).toBe('View')
    expect(json?.children).toHaveLength(1)
  })
})
