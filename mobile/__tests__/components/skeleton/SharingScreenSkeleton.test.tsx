import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { SharingScreenSkeleton } from '../../../src/components/skeleton/SharingScreenSkeleton'

describe('SharingScreenSkeleton', () => {
  it('renders skeleton container', () => {
    render(<SharingScreenSkeleton testID="sharing-skeleton" />)

    expect(screen.getByTestId('sharing-skeleton')).toBeTruthy()
  })

  it('renders balance card skeleton', () => {
    render(<SharingScreenSkeleton testID="sharing-skeleton" />)

    expect(screen.getByTestId('sharing-skeleton.balanceCard')).toBeTruthy()
  })

  it('renders Shared With You section title', () => {
    render(<SharingScreenSkeleton testID="sharing-skeleton" />)

    expect(screen.getByText('Shared With You')).toBeTruthy()
  })

  it('renders You Shared section title', () => {
    render(<SharingScreenSkeleton testID="sharing-skeleton" />)

    expect(screen.getByText('You Shared')).toBeTruthy()
  })

  it('renders 2 shared with me skeletons', () => {
    render(<SharingScreenSkeleton testID="sharing-skeleton" />)

    for (let i = 0; i < 2; i++) {
      expect(screen.getByTestId(`sharing-skeleton.sharedWithMe.${i}`)).toBeTruthy()
    }
  })

  it('renders 2 shared by me skeletons', () => {
    render(<SharingScreenSkeleton testID="sharing-skeleton" />)

    for (let i = 0; i < 2; i++) {
      expect(screen.getByTestId(`sharing-skeleton.sharedByMe.${i}`)).toBeTruthy()
    }
  })

  it('renders without testID', () => {
    const { toJSON } = render(<SharingScreenSkeleton />)

    expect(toJSON()).toBeTruthy()
  })
})
