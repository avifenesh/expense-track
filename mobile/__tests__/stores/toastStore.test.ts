import { useToastStore } from '../../src/stores/toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.getState().reset()
  })

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useToastStore.getState()
      expect(state.visible).toBe(false)
      expect(state.message).toBe('')
      expect(state.type).toBe('info')
      expect(state.duration).toBe(3000)
    })
  })

  describe('showToast', () => {
    it('shows toast with provided message and type', () => {
      useToastStore.getState().showToast('Test message', 'success')

      const state = useToastStore.getState()
      expect(state.visible).toBe(true)
      expect(state.message).toBe('Test message')
      expect(state.type).toBe('success')
      expect(state.duration).toBe(3000)
    })

    it('uses custom duration when provided', () => {
      useToastStore.getState().showToast('Test message', 'error', 5000)

      const state = useToastStore.getState()
      expect(state.duration).toBe(5000)
    })

    it('accepts all toast types', () => {
      useToastStore.getState().showToast('Success', 'success')
      expect(useToastStore.getState().type).toBe('success')

      useToastStore.getState().showToast('Error', 'error')
      expect(useToastStore.getState().type).toBe('error')

      useToastStore.getState().showToast('Info', 'info')
      expect(useToastStore.getState().type).toBe('info')
    })
  })

  describe('hideToast', () => {
    it('hides visible toast', () => {
      useToastStore.getState().showToast('Test', 'success')
      expect(useToastStore.getState().visible).toBe(true)

      useToastStore.getState().hideToast()
      expect(useToastStore.getState().visible).toBe(false)
    })

    it('preserves other state when hiding', () => {
      useToastStore.getState().showToast('Test message', 'error', 5000)
      useToastStore.getState().hideToast()

      const state = useToastStore.getState()
      expect(state.visible).toBe(false)
      expect(state.message).toBe('Test message')
      expect(state.type).toBe('error')
    })
  })

  describe('success', () => {
    it('shows success toast with message', () => {
      useToastStore.getState().success('Operation successful')

      const state = useToastStore.getState()
      expect(state.visible).toBe(true)
      expect(state.message).toBe('Operation successful')
      expect(state.type).toBe('success')
      expect(state.duration).toBe(3000)
    })

    it('uses custom duration when provided', () => {
      useToastStore.getState().success('Success!', 2000)

      const state = useToastStore.getState()
      expect(state.duration).toBe(2000)
    })
  })

  describe('error', () => {
    it('shows error toast with message', () => {
      useToastStore.getState().error('Something went wrong')

      const state = useToastStore.getState()
      expect(state.visible).toBe(true)
      expect(state.message).toBe('Something went wrong')
      expect(state.type).toBe('error')
      expect(state.duration).toBe(3000)
    })

    it('uses custom duration when provided', () => {
      useToastStore.getState().error('Error!', 4000)

      const state = useToastStore.getState()
      expect(state.duration).toBe(4000)
    })
  })

  describe('info', () => {
    it('shows info toast with message', () => {
      useToastStore.getState().info('Information for you')

      const state = useToastStore.getState()
      expect(state.visible).toBe(true)
      expect(state.message).toBe('Information for you')
      expect(state.type).toBe('info')
      expect(state.duration).toBe(3000)
    })

    it('uses custom duration when provided', () => {
      useToastStore.getState().info('Info!', 1500)

      const state = useToastStore.getState()
      expect(state.duration).toBe(1500)
    })
  })

  describe('reset', () => {
    it('resets to initial state', () => {
      useToastStore.getState().showToast('Test', 'error', 5000)
      useToastStore.getState().reset()

      const state = useToastStore.getState()
      expect(state.visible).toBe(false)
      expect(state.message).toBe('')
      expect(state.type).toBe('info')
      expect(state.duration).toBe(3000)
    })
  })

  describe('multiple toasts', () => {
    it('replaces previous toast when showing new one', () => {
      useToastStore.getState().success('First toast')
      useToastStore.getState().error('Second toast')

      const state = useToastStore.getState()
      expect(state.message).toBe('Second toast')
      expect(state.type).toBe('error')
    })
  })
})
