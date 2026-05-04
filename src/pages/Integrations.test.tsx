import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import Integrations from './Integrations'

// Mock assets required by Sidebar
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

// Mock the api module
const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { baseURL: 'http://localhost:5000/api' },
  },
}))

const disconnectedData = {
  data: {
    xero: { connected: false, connectedAt: null, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null },
    quickbooks: { connected: false, connectedAt: null, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null },
    sage: { connected: false, connectedAt: null, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null },
  },
}

describe('Integrations page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders all three provider names and Connect buttons when all disconnected', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/integrations')) {
        return Promise.resolve({ data: disconnectedData })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test Cafe' } } })
      }
      return Promise.reject(new Error(`Unexpected GET: ${url}`))
    })

    render(<Integrations />)

    await waitFor(() => {
      expect(screen.getByText('Xero')).toBeInTheDocument()
    })

    expect(screen.getByText('QuickBooks')).toBeInTheDocument()
    expect(screen.getByText('Sage Accounting')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /connect xero/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect quickbooks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect sage/i })).toBeInTheDocument()
  })
})
