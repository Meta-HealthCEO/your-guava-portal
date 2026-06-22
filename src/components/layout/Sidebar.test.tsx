import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AuthContext } from '@/contexts/AuthContext'
import { Sidebar } from './Sidebar'
import type { ReactNode } from 'react'

vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { cafe: { name: 'Test Cafe' } } }),
  },
}))

function renderSidebar(path: string) {
  const user = {
    id: 'user123',
    email: 'test@yourguava.com',
    name: 'Test Owner',
    role: 'owner' as const,
    orgId: 'org123',
    cafeIds: ['cafe123'],
    activeCafeId: 'cafe123',
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          isOwner: true,
          login: vi.fn(),
          logout: vi.fn(),
          register: vi.fn(),
          switchCafe: vi.fn(),
        }}
      >
        {children}
      </AuthContext.Provider>
    </MemoryRouter>
  )

  return render(<Sidebar />, { wrapper })
}

function expectActive(label: string) {
  expect(screen.getByRole('link', { name: label }).className).toContain('bg-guava-red/10')
}

function expectInactive(label: string) {
  expect(screen.getByRole('link', { name: label }).className).not.toContain('bg-guava-red/10')
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not highlight Planning when Forecast Factors is selected', () => {
    renderSidebar('/planning/factors')

    expectActive('Factors')
    expectInactive('Planning')
  })

  it('does not highlight Data Health when Menu Items is selected', () => {
    renderSidebar('/data-health/menu-items')

    expectActive('Menu Items')
    expectInactive('Data Health')
  })

  it('highlights only History on the history page', () => {
    renderSidebar('/history')

    expectActive('History')
    expectInactive('Performance')
    expectInactive('Ask Guava')
  })

  it('uses one Settings entry for setup and keeps old account route active', () => {
    renderSidebar('/account')

    expect(screen.queryByRole('link', { name: 'Account' })).not.toBeInTheDocument()
    expectActive('Settings')
  })

  it('highlights Improvements on the improvements page', () => {
    renderSidebar('/improvements')

    expectActive('Improvements')
    expectInactive('Settings')
  })
})
