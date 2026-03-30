import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@/test/test-utils'
import Connect from './Connect'

// Mock assets
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

// Mock the api module
const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('@/lib/api', () => {
  return {
    default: {
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
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

describe('Connect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Default: yoco not connected
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/yoco/status')) {
        return Promise.resolve({
          data: { connected: false, lastSyncAt: null, tokenExpiresAt: null, success: true },
        })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
  })

  it('renders upload dropzone', async () => {
    render(<Connect />)

    await waitFor(() => {
      expect(screen.getByText(/drop your yoco csv or xlsx here/i)).toBeInTheDocument()
    })
  })

  it('shows file type validation error for invalid file', async () => {
    render(<Connect />)

    await waitFor(() => {
      expect(screen.getByText(/drop your yoco csv or xlsx here/i)).toBeInTheDocument()
    })

    // Create an invalid file and use fireEvent for the hidden input
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    // Use fireEvent.change instead of userEvent.upload for hidden inputs
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument()
    })
  })

  it('shows upload progress during upload', async () => {
    mockPost.mockImplementation(() => new Promise(() => {})) // Hang to stay in uploading state

    render(<Connect />)

    await waitFor(() => {
      expect(screen.getByText(/drop your yoco csv or xlsx here/i)).toBeInTheDocument()
    })

    const file = new File(['col1,col2\n1,2'], 'data.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/uploading/i)).toBeInTheDocument()
    })
  })

  it('shows success state with import count after upload', async () => {
    mockPost.mockImplementation((url: string) => {
      if (url.includes('/transactions/upload')) {
        return Promise.resolve({
          data: { imported: 500, skipped: 10, total: 510, firstDate: '2025-12-01', lastDate: '2026-03-27' },
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<Connect />)

    await waitFor(() => {
      expect(screen.getByText(/drop your yoco csv or xlsx here/i)).toBeInTheDocument()
    })

    const file = new File(['col1,col2\n1,2'], 'data.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Import successful')).toBeInTheDocument()
    })

    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('510')).toBeInTheDocument()
  })

  it('renders Yoco integration section', async () => {
    render(<Connect />)

    await waitFor(() => {
      expect(screen.getByText('Yoco Live Integration')).toBeInTheDocument()
    })
  })
})
