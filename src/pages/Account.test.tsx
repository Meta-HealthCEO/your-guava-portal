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

function accountPayload(role: 'owner' | 'manager' = 'owner') {
  return {
    user: {
      id: 'user123',
      email: 'test@yourguava.com',
      name: 'Test Owner',
      role,
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
      guavaCredits: { included: 1800, bonus: 250, used: 100, available: 1950, resetAt: '2026-06-01T00:00:00.000Z' },
      creditLedger: {
        byFeature: [
          { featureKey: 'ask_guava_chat', label: 'Ask Guava answer', credits: 12, count: 4 },
        ],
        recent: [
          {
            id: 'usage1',
            featureKey: 'ask_guava_chat',
            label: 'Ask Guava answer',
            credits: 3,
            status: 'committed',
            provider: 'anthropic',
            createdAt: '2026-05-20T00:00:00.000Z',
          },
        ],
      },
    },
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        priceMonthly: 399,
        priceAnnual: 3990,
        includedSeats: 2,
        includedAiCredits: 150,
        includedGuavaCredits: 400,
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
        includedGuavaCredits: 1800,
        includedLocations: 3,
        overagePerSeat: 100,
        aiCreditPackPrice: 89,
        features: ['Multi-location forecasting'],
      },
    ],
  }
}

function renderWithAuth(
  ui: ReactNode,
  {
    logout = vi.fn().mockResolvedValue(undefined),
    role = 'owner',
  }: { logout?: () => Promise<void>; role?: 'owner' | 'manager' } = {}
) {
  const user = {
    id: 'user123',
    email: 'test@yourguava.com',
    name: 'Test Owner',
    role,
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
          isOwner: role === 'owner',
          login: vi.fn(),
          logout,
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
    window.history.pushState({}, '', '/account')
    mockPost.mockResolvedValue({ data: { success: true } })
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
    expect(screen.getByText('1950')).toBeInTheDocument()
    expect(screen.getAllByText('Ask Guava answer').length).toBeGreaterThan(0)
    expect(screen.getByText('Plans and card checkout')).toBeInTheDocument()
  })

  it('defaults the account details section to view mode', async () => {
    renderWithAuth(<Account />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    })

    expect(screen.getByText('Test Org')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Test Owner')).not.toBeInTheDocument()
    expect(screen.queryByText('Save Account')).not.toBeInTheDocument()
  })

  it('enters edit mode and cancels back without saving', async () => {
    renderWithAuth(<Account />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))

    const nameInput = await screen.findByDisplayValue('Test Owner')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Discarded Name')

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByDisplayValue('Discarded Name')).not.toBeInTheDocument()
    })
    expect(mockPatch).not.toHaveBeenCalled()
    expect(screen.queryByText('Save Account')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  }, 10000)

  it('saves profile and organisation details', async () => {
    mockPatch.mockResolvedValueOnce({ data: { success: true, account: accountPayload() } })

    renderWithAuth(<Account />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))

    const nameInput = await screen.findByDisplayValue('Test Owner')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Updated Owner')
    await userEvent.click(screen.getByText('Save Account'))

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/account/profile', expect.objectContaining({
        name: 'Updated Owner',
      }))
    })
  })

  it('submits only the editable name field for managers', async () => {
    const managerAccount = accountPayload('manager')
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/account')) return Promise.resolve({ data: { success: true, account: managerAccount } })
      return Promise.resolve({ data: {} })
    })
    mockPatch.mockResolvedValueOnce({ data: { success: true, account: managerAccount } })

    renderWithAuth(<Account />, { role: 'manager' })
    await userEvent.click(await screen.findByRole('button', { name: /^edit$/i }))

    expect(screen.queryByLabelText(/organisation name/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/billing email/i)).not.toBeInTheDocument()
    const nameInput = screen.getByLabelText(/full name/i)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Manager Name')
    await userEvent.click(screen.getByText('Save Account'))

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/account/profile', { name: 'Manager Name' })
    })
  })

  it('verifies a payment reference before showing confirmation', async () => {
    window.history.pushState({}, '', '/account?payment=paid&reference=pay-123')
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/account/payments/pay-123')) {
        return Promise.resolve({ data: { success: true, payment: { reference: 'pay-123', status: 'paid' } } })
      }
      if (url.includes('/account')) {
        return Promise.resolve({ data: { success: true, account: accountPayload() } })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithAuth(<Account />)

    expect(await screen.findByText(/card payment confirmed/i)).toBeInTheDocument()
    expect(mockGet).toHaveBeenCalledWith('/account/payments/pay-123')
  })

  it('reuses the credit-checkout idempotency key after a network failure', async () => {
    mockPost
      .mockRejectedValueOnce(new Error('connection dropped'))
      .mockResolvedValueOnce({
        data: {
          success: true,
          account: accountPayload(),
          purchase: { provider: 'mock', credits: 500, status: 'paid' },
        },
      })

    renderWithAuth(<Account />)
    const button = await screen.findByRole('button', { name: /add 500 guava credits/i })
    await userEvent.click(button)
    expect(await screen.findByText(/could not start card checkout/i)).toBeInTheDocument()

    await userEvent.click(button)
    await waitFor(() => {
      const calls = mockPost.mock.calls.filter(([url]) => url === '/account/ai-credits')
      expect(calls).toHaveLength(2)
      const firstKey = calls[0][2]?.headers?.['Idempotency-Key']
      const secondKey = calls[1][2]?.headers?.['Idempotency-Key']
      expect(firstKey).toMatch(/^credits:/)
      expect(secondKey).toBe(firstKey)
    })
  })

  it('changes password and signs the user out', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    mockPost.mockResolvedValueOnce({ data: { success: true } })

    renderWithAuth(<Account />, { logout })

    await waitFor(() => {
      expect(screen.getByText('Password')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText(/^Current Password$/i), 'password123')
    await userEvent.type(screen.getByLabelText(/^New Password$/i), 'newpassword456')
    await userEvent.type(screen.getByLabelText(/^Confirm Password$/i), 'newpassword456')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'password123',
        newPassword: 'newpassword456',
      })
      expect(logout).toHaveBeenCalled()
    })
    expect(screen.getByText(/please sign in again/i)).toBeInTheDocument()
  })

  it('does not submit password changes when confirmation does not match', async () => {
    renderWithAuth(<Account />)

    await waitFor(() => {
      expect(screen.getByText('Password')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText(/^Current Password$/i), 'password123')
    await userEvent.type(screen.getByLabelText(/^New Password$/i), 'newpassword456')
    await userEvent.type(screen.getByLabelText(/^Confirm Password$/i), 'different456')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(screen.getByText(/confirmation do not match/i)).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalledWith('/auth/change-password', expect.anything())
  })
})
