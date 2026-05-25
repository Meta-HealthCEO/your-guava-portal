import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import UploadDetail from './UploadDetail'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { role: 'owner' }, isLoading: false, isOwner: true }),
}))

const apiMock = api as unknown as { get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

function mockUploadDetail() {
  apiMock.get.mockImplementation((url: string) => {
    if (url.endsWith('/rows')) {
      return Promise.resolve({ data: { transactions: [], pagination: { total: 0, page: 1, limit: 50, pages: 1 } } })
    }
    return Promise.resolve({
      data: {
        upload: {
          _id: 'u1',
          fileName: 'export.csv',
          status: 'completed',
          stats: { imported: 4, skipped: 0, errors: 0, totalRows: 4 },
          posType: 'yoco',
          createdAt: new Date().toISOString(),
          uploadedBy: { name: 'Shaun', email: 's@x.za' },
          dateRange: { firstDate: '2026-04-01', lastDate: '2026-04-02' },
        },
        downloadUrl: 'https://test.r2.local/foo',
      },
    })
  })
}

function renderUploadDetail() {
  return render(
    <MemoryRouter initialEntries={["/uploads/u1"]}>
      <Routes>
        <Route path="/uploads/:id" element={<UploadDetail />} />
        <Route path="/data-health" element={<div>Data Health page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('UploadDetail', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
    apiMock.delete.mockReset()
  })

  it('renders upload metadata and a download link', async () => {
    mockUploadDetail()
    renderUploadDetail()
    await waitFor(() => expect(screen.getByText('export.csv')).toBeInTheDocument())
    expect(screen.getAllByText(/imported/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute('href', 'https://test.r2.local/foo')
  })

  it('uses an app confirmation dialog when deleting an upload', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)
    apiMock.delete.mockResolvedValue({ data: { success: true } })
    mockUploadDetail()

    renderUploadDetail()

    await waitFor(() => expect(screen.getByText('export.csv')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /delete this upload/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /delete upload/i })).toBeInTheDocument()
    expect(screen.getByText(/linked transactions from export\.csv/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^delete upload$/i }))

    await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith('/uploads/u1'))
    await waitFor(() => expect(screen.getByText('Data Health page')).toBeInTheDocument())

    confirmSpy.mockRestore()
  })

  it('pages through imported transactions', async () => {
    apiMock.get.mockImplementation((url: string, config?: { params?: { page?: number; limit?: number } }) => {
      if (url.endsWith('/rows')) {
        const page = config?.params?.page || 1
        const transaction = page === 1
          ? {
              _id: 'r1',
              date: '2026-05-24T08:00:00.000Z',
              receiptId: '001',
              total: 42,
              items: [{ name: 'Flat White', quantity: 1 }],
            }
          : {
              _id: 'r2',
              date: '2026-05-23T09:00:00.000Z',
              receiptId: '051',
              total: 55,
              items: [{ name: 'Long White', quantity: 1 }],
            }

        return Promise.resolve({
          data: {
            transactions: [transaction],
            pagination: { total: 101, page, limit: 50, pages: 3 },
          },
        })
      }

      return Promise.resolve({
        data: {
          upload: {
            _id: 'u1',
            fileName: 'export.csv',
            status: 'completed',
            stats: { imported: 101, skipped: 0, errors: 0, totalRows: 101 },
            posType: 'yoco',
            createdAt: new Date().toISOString(),
            uploadedBy: { name: 'Shaun', email: 's@x.za' },
            dateRange: { firstDate: '2026-04-01', lastDate: '2026-04-02' },
          },
          downloadUrl: 'https://test.r2.local/foo',
        },
      })
    })

    renderUploadDetail()

    await waitFor(() => expect(screen.getByText(/Flat White/)).toBeInTheDocument())
    expect(screen.getByText(/Showing 1-50 of 101/i)).toBeInTheDocument()
    expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next page/i }))

    await waitFor(() => expect(screen.getByText(/Long White/)).toBeInTheDocument())
    expect(screen.getByText(/Showing 51-100 of 101/i)).toBeInTheDocument()
    expect(apiMock.get).toHaveBeenCalledWith('/uploads/u1/rows', { params: { page: 2, limit: 50 } })
  })
})
