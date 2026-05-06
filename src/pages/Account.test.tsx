import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import userEvent from '@testing-library/user-event'
import Account from './Account'
import type { ReactNode } from 'react'

vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()

vi.mock('@/lib/api', () => {
  return {
    default: {
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
      patch: (...args: unknown[]) => mockPatch(...args),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: { baseURL: 'http://localhost:5000/api' },
    },
  }
})

function accountPayload() {
  return {
    user: {
      id: 'user123',
      email: 'test@yourguava.com',
      name: 'Test Owner',
      role: 'owner',
      orgId: 'org123',
      cafeIds: ['cafe123'],
      activeCafeId: 'cafe123',
    },
    organization: {
      _id: 'org123',
      name: 'Test Org',
      ownerId: 'user123',
      plan: 'growth',
      billingStatus: 'active',
      billingCycle: 'monthly',
      billingEmail: 'billing@yourguava.com',
      paymentMethod: { brand: 'visa', last4: '4242', expiresAt: '12/30' },
    },
    usage: {
      seats: { used: 3, included: 6, remaining: 3 },
      locations: { used: 2, included: 3, remaining: 1 },
      aiCredits: { included: 600, bonus: 250, used: 100, available: 750, resetAt: null },
    },
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        priceMonthly: 399,
        priceAnnual: 3990,
        includedSeats: 2,
        includedAiCredits: 150,
        includedLocations: 2,
        overagePerSeat: 120,
        aiCreditPackPrice: 99,
        features: ['CSV imports'],
      },
      {
        id: 'growth',
        name: 'Growth',
        priceMonthly: 899,
        priceAnnual: 8990,
        includedSeats: 6,
        includedAiCredits: 600,
        includedLocations: 3,
        overagePerSeat: 100,
        aiCreditPackPrice: 89,
        features: ['Multi-location forecasting'],
      },
    ],
  }
}

function renderWithAuth(ui: ReactNode) {
  const user = {
    id: 'user123',
    email: 'test@yourguava.com',
    name: 'Test Owner',
    role: 'owner' as const,
    orgId: 'org123',
    cafeIds: ['cafe123'],
    activeCafeId: 'cafe123',
  }

  return render(
    <BrowserRouter>
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
        {ui}
      </AuthContext.Provider>
    </BrowserRouter>
  )
}

describe('Account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/account')) {
        return Promise.resolve({ data: { success: true, account: accountPayload() } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test Cafe' } } })
      }
      return Promise.resolve({ data: {} })
    })
  })

  it('renders account details separately from billing and usage', async () => {
    renderWithAuth(<Account />)

    await waitFor(() => {
      expect(screen.getByText('Account Details')).toBeInTheDocument()
      expect(screen.getByText('Billing and Usage')).toBeInTheDocument()
    })

    expect(screen.getByText('growth plan')).toBeInTheDocument()
    expect(screen.getByText('750')).toBeInTheDocument()
    expect(screen.getByText('Plans and mock checkout')).toBeInTheDocument()
  })

  it('saves profile and organisation details', async () => {
    mockPatch.mockResolvedValueOnce({ data: { success: true, account: accountPayload() } })

    renderWithAuth(<Account />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Owner')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Test Owner')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Updated Owner')
    await userEvent.click(screen.getByText('Save Account'))

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/account/profile', expect.objectContaining({
        name: 'Updated Owner',
      }))
    })
  })
})
