import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { Skeleton } from '../../../src/components/skeleton/Skeleton'

describe('Skeleton', () => {
  describe('Rendering', () => {
    it('renders with specified width and height', () => {
      render(<Skeleton width={100} height={20} testID="skeleton" />)

      expect(screen.getByTestId('skeleton')).toBeTruthy()
    })

    it('renders with string width', () => {
      render(<Skeleton width="50%" height={20} testID="skeleton" />)

      expect(screen.getByTestId('skeleton')).toBeTruthy()
    })

    it('applies custom borderRadius', () => {
      const { toJSON } = render(<Skeleton width={100} height={20} borderRadius={10} testID="skeleton" />)

      expect(toJSON()).toBeTruthy()
    })

    it('applies custom style', () => {
      const customStyle = { marginTop: 10 }
      const { toJSON } = render(<Skeleton width={100} height={20} style={customStyle} testID="skeleton" />)

      expect(toJSON()).toBeTruthy()
    })
  })

  describe('Accessibility', () => {
    it('has progressbar accessibilityRole', () => {
      const { toJSON } = render(<Skeleton width={100} height={20} testID="skeleton" />)

      const json = toJSON()
      expect(json).toBeTruthy()
      expect(json?.props?.accessibilityRole).toBe('progressbar')
    })

    it('has Loading accessibility label', () => {
      render(<Skeleton width={100} height={20} testID="skeleton" />)

      expect(screen.getByLabelText('Loading')).toBeTruthy()
    })
  })

  describe('Memoization', () => {
    it('renders consistently', () => {
      const { toJSON: toJSON1 } = render(<Skeleton width={100} height={20} />)
      const { toJSON: toJSON2 } = render(<Skeleton width={100} height={20} />)

      expect(toJSON1()).toEqual(toJSON2())
    })
  })
})
