import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { TopToolbar } from './TopToolbar'
import { AuthContext } from '@/contexts/AuthContext'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
}))

const apiMock = api as unknown as { get: ReturnType<typeof vi.fn> }

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

function renderToolbar({ available = 1234, logout = vi.fn().mockResolvedValue(undefined) } = {}) {
  apiMock.get.mockResolvedValue({
    data: {
      credits: { included: 500, bonus: 1000, used: 266, available, resetAt: '2026-06-01T00:00:00.000Z' },
      organization: { plan: 'starter', billingStatus: 'trialing', billingCycle: 'monthly' },
      plan: { id: 'starter', name: 'Starter', includedGuavaCredits: 500 },
    },
  })

  render(
    <MemoryRouter initialEntries={['/today']}>
      <AuthContext.Provider
        value={{
          user: {
            id: 'u1',
            email: 'shaun@example.com',
            name: 'Shaun Schoeman',
            role: 'owner',
            orgId: 'org1',
            cafeIds: ['cafe1'],
            activeCafeId: 'cafe1',
          },
          isLoading: false,
          isOwner: true,
          login: vi.fn(),
          logout,
          register: vi.fn(),
          switchCafe: vi.fn(),
        }}
      >
        <TopToolbar />
        <LocationProbe />
      </AuthContext.Provider>
    </MemoryRouter>
  )

  return { logout }
}

describe('TopToolbar', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
  })

  it('shows the Guava Credits balance and links it to billing settings', async () => {
    renderToolbar()

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/account/credits'))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /guava credits balance/i })).toHaveTextContent(/1\s?234/)
    })

    fireEvent.click(screen.getByRole('button', { name: /guava credits balance/i }))

    expect(screen.getByTestId('location')).toHaveTextContent('/settings?section=billing')
  })

  it('surfaces low-credit notifications', async () => {
    renderToolbar({ available: 42 })

    await screen.findByText('42')
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText(/credits running low/i)).toBeInTheDocument()
    expect(screen.getByText(/42 Guava Credits available/i)).toBeInTheDocument()
  })

  it('opens the user menu and signs out', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    renderToolbar({ logout })

    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    expect(screen.getByText('shaun@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(logout).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'))
  })
})
