import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button.className).toContain('bg-[#D43D3D]')
  })

  it('renders with destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button', { name: /delete/i })
    expect(button.className).toContain('text-red-400')
  })

  it('renders with outline variant', () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole('button', { name: /outline/i })
    expect(button.className).toContain('border')
    expect(button.className).toContain('bg-transparent')
  })

  it('renders with ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const button = screen.getByRole('button', { name: /ghost/i })
    expect(button.className).toContain('text-[#888888]')
  })

  it('renders with success variant', () => {
    render(<Button variant="success">Save</Button>)
    const button = screen.getByRole('button', { name: /save/i })
    expect(button.className).toContain('bg-[#4DA63B]')
  })

  it('renders with sm size', () => {
    render(<Button size="sm">Small</Button>)
    const button = screen.getByRole('button', { name: /small/i })
    expect(button.className).toContain('h-8')
  })

  it('renders with lg size', () => {
    render(<Button size="lg">Large</Button>)
    const button = screen.getByRole('button', { name: /large/i })
    expect(button.className).toContain('h-11')
  })

  it('renders with icon size', () => {
    render(<Button size="icon">X</Button>)
    const button = screen.getByRole('button', { name: /x/i })
    expect(button.className).toContain('w-9')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button', { name: /click/i }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: /link button/i })
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('A')
  })

  it('shows disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button', { name: /disabled/i })
    expect(button).toBeDisabled()
  })
})
