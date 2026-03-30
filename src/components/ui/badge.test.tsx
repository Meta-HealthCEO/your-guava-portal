import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './badge'

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-[#D43D3D]/20')
  })

  it('renders with success variant', () => {
    render(<Badge variant="success">Success</Badge>)
    const badge = screen.getByText('Success')
    expect(badge.className).toContain('bg-[#4DA63B]/20')
  })

  it('renders with warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>)
    const badge = screen.getByText('Warning')
    expect(badge.className).toContain('bg-[#FFD166]/20')
  })

  it('renders with destructive variant', () => {
    render(<Badge variant="destructive">Error</Badge>)
    const badge = screen.getByText('Error')
    expect(badge.className).toContain('bg-red-900/30')
  })

  it('renders with outline variant', () => {
    render(<Badge variant="outline">Outline</Badge>)
    const badge = screen.getByText('Outline')
    expect(badge.className).toContain('border-[#2A2A2A]')
  })

  it('renders with pro variant', () => {
    render(<Badge variant="pro">Pro</Badge>)
    const badge = screen.getByText('Pro')
    expect(badge.className).toContain('uppercase')
    expect(badge.className).toContain('bg-[#D43D3D]/20')
  })

  it('renders with basic variant', () => {
    render(<Badge variant="basic">Basic</Badge>)
    const badge = screen.getByText('Basic')
    expect(badge.className).toContain('uppercase')
    expect(badge.className).toContain('bg-[#2A2A2A]')
  })
})
