import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card'

describe('Card', () => {
  it('renders Card with all sub-components', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card body content</p>
        </CardContent>
        <CardFooter>
          <p>Footer text</p>
        </CardFooter>
      </Card>
    )

    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()
    expect(screen.getByText('Card body content')).toBeInTheDocument()
    expect(screen.getByText('Footer text')).toBeInTheDocument()
  })

  it('applies custom className to Card', () => {
    const { container } = render(<Card className="custom-class">Content</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('custom-class')
    expect(card.className).toContain('rounded-xl')
  })

  it('applies custom className to CardHeader', () => {
    const { container } = render(<CardHeader className="header-class">Header</CardHeader>)
    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('header-class')
  })

  it('renders CardTitle as h3', () => {
    render(<CardTitle>My Title</CardTitle>)
    const title = screen.getByText('My Title')
    expect(title.tagName).toBe('H3')
  })

  it('renders CardDescription as p', () => {
    render(<CardDescription>My Description</CardDescription>)
    const desc = screen.getByText('My Description')
    expect(desc.tagName).toBe('P')
  })
})
