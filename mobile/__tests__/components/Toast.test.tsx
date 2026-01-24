import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Toast } from '../../src/components/Toast'
import { useToastStore } from '../../src/stores/toastStore'

// Mock safe area insets
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 44, right: 0, bottom: 34, left: 0 }
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => inset,
  }
})

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useToastStore.getState().reset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const renderToast = () => {
    return render(
      <SafeAreaProvider>
        <Toast />
      </SafeAreaProvider>,
    )
  }

  it('renders nothing when not visible', () => {
    const { queryByTestId } = renderToast()
    expect(queryByTestId('toast-container')).toBeNull()
  })

  it('renders toast when visible', () => {
    const { queryByTestId } = renderToast()

    act(() => {
      useToastStore.getState().success('Test message')
    })

    expect(queryByTestId('toast-container')).toBeTruthy()
  })

  it('displays the correct message', () => {
    const { getByTestId, queryByTestId } = renderToast()

    act(() => {
      useToastStore.getState().success('Hello World')
    })

    expect(queryByTestId('toast-message')).toBeTruthy()
    expect(getByTestId('toast-message').props.children).toBe('Hello World')
  })

  it('applies success color for success toast', () => {
    const { getByTestId } = renderToast()

    act(() => {
      useToastStore.getState().success('Success!')
    })

    const container = getByTestId('toast-container')
    const style = container.props.style
    const flatStyle = Array.isArray(style) ? style.reduce((acc, s) => ({ ...acc, ...s }), {}) : style
    expect(flatStyle.backgroundColor).toBe('#22c55e')
  })

  it('applies error color for error toast', () => {
    const { getByTestId } = renderToast()

    act(() => {
      useToastStore.getState().error('Error!')
    })

    const container = getByTestId('toast-container')
    const style = container.props.style
    const flatStyle = Array.isArray(style) ? style.reduce((acc, s) => ({ ...acc, ...s }), {}) : style
    expect(flatStyle.backgroundColor).toBe('#ef4444')
  })

  it('applies info color for info toast', () => {
    const { getByTestId } = renderToast()

    act(() => {
      useToastStore.getState().info('Info!')
    })

    const container = getByTestId('toast-container')
    const style = container.props.style
    const flatStyle = Array.isArray(style) ? style.reduce((acc, s) => ({ ...acc, ...s }), {}) : style
    expect(flatStyle.backgroundColor).toBe('#38bdf8')
  })

  it('hides toast when pressed', () => {
    const { getByTestId, queryByTestId } = renderToast()

    act(() => {
      useToastStore.getState().success('Tap to dismiss')
    })

    expect(queryByTestId('toast-container')).toBeTruthy()

    fireEvent.press(getByTestId('toast-touchable'))

    // Run the animation duration
    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(useToastStore.getState().visible).toBe(false)
  })

  it('auto-dismisses after duration', () => {
    renderToast()

    act(() => {
      useToastStore.getState().success('Auto dismiss', 2000)
    })

    expect(useToastStore.getState().visible).toBe(true)

    // Advance past the duration
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    // Advance past animation
    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(useToastStore.getState().visible).toBe(false)
  })

  it('has correct accessibility properties', () => {
    const { getByTestId } = renderToast()

    act(() => {
      useToastStore.getState().success('Accessible toast')
    })

    const touchable = getByTestId('toast-touchable')
    expect(touchable.props.accessibilityRole).toBe('alert')
    expect(touchable.props.accessibilityLabel).toBe('Accessible toast')
  })

  it('handles multiple toasts by replacing previous', () => {
    const { getByTestId } = renderToast()

    act(() => {
      useToastStore.getState().success('First toast')
    })

    expect(getByTestId('toast-message').props.children).toBe('First toast')

    act(() => {
      useToastStore.getState().error('Second toast')
    })

    expect(getByTestId('toast-message').props.children).toBe('Second toast')
  })

  it('clears existing timeout when new toast is shown', () => {
    renderToast()

    act(() => {
      useToastStore.getState().success('First', 5000)
    })

    // Advance partway through first toast
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    // Show second toast
    act(() => {
      useToastStore.getState().error('Second', 3000)
    })

    // The first toast should not auto-dismiss now
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    // Should dismiss from second toast's timer
    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(useToastStore.getState().visible).toBe(false)
  })
})
