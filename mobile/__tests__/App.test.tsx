import { render, screen } from '@testing-library/react-native'
import App from '../App'

describe('App', () => {
  it('renders app title', () => {
    render(<App />)
    expect(screen.getByText('Expense Track')).toBeTruthy()
  })

  it('renders app subtitle', () => {
    render(<App />)
    expect(screen.getByText('Mobile App')).toBeTruthy()
  })
})
