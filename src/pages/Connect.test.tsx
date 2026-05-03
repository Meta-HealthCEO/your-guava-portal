import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@/test/test-utils'
import Connect from './Connect'

// Mock assets
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

// Mock ColumnMappingWizard for wizard-appearance tests
vi.mock('@/components/upload/ColumnMappingWizard', () => ({
  ColumnMappingWizard: ({ open }: { open: boolean }) =>
    open ? <div data-testid="column-mapping-wizard">Map your CSV columns</div> : null,
}))

// Mock UploadHistoryCard to avoid API calls in tests
vi.mock('@/components/upload/UploadHistoryCard', () => ({
  UploadHistoryCard: () => <div data-testid="upload-history-card" />,
}))

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
          data: {
            uploadId: 'mock-id',
            posType: 'yoco',
            columnMapping: { date: 'Date', total: 'Total' },
            itemsMode: 'packed',
            headers: ['Date', 'Total'],
            preview: [],
            needsConfirmation: false,
          },
        })
      }
      if (url.includes('/uploads/mock-id/confirm')) {
        return Promise.resolve({
          data: { stats: { imported: 500, skipped: 10, errors: 0, totalRows: 510 } },
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

  it('opens the mapping wizard when needsConfirmation is true', async () => {
    mockPost.mockImplementation((url: string) => {
      if (url === '/transactions/upload') {
        return Promise.resolve({
          data: {
            uploadId: 'u1',
            posType: 'wizard',
            columnMapping: { date: 'When' },
            itemsMode: 'packed',
            headers: ['When', 'Items', 'Total'],
            preview: [],
            needsConfirmation: true,
          },
        })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Connect />)

    await waitFor(() => {
      expect(screen.getByText(/drop your yoco csv or xlsx here/i)).toBeInTheDocument()
    })

    const file = new File(['When,Items,Total\n2026-01-01,Coffee,50'], 'data.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByTestId('column-mapping-wizard')).toBeInTheDocument()
    })

    expect(screen.getByText('Map your CSV columns')).toBeInTheDocument()
  })
})
