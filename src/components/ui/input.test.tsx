import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './input'

describe('Input', () => {
  it('renders input', () => {
    render(<Input data-testid="test-input" />)
    expect(screen.getByTestId('test-input')).toBeInTheDocument()
  })

  it('handles value changes', async () => {
    render(<Input placeholder="Type here" />)
    const input = screen.getByPlaceholderText('Type here')
    await userEvent.type(input, 'hello')
    expect(input).toHaveValue('hello')
  })

  it('shows disabled state', () => {
    render(<Input disabled placeholder="Disabled" />)
    const input = screen.getByPlaceholderText('Disabled')
    expect(input).toBeDisabled()
  })

  it('renders with placeholder', () => {
    render(<Input placeholder="Enter email" />)
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument()
  })

  it('renders with type', () => {
    render(<Input type="password" placeholder="Password" />)
    const input = screen.getByPlaceholderText('Password')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('applies custom className', () => {
    const { container } = render(<Input className="custom-input" />)
    const input = container.querySelector('input')
    expect(input?.className).toContain('custom-input')
  })
})
