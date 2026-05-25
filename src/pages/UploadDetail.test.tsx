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
    if (url.endsWith('/rows')) return Promise.resolve({ data: { transactions: [], pagination: { total: 0 } } })
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
    expect(screen.getByText(/imported/i)).toBeInTheDocument()
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
})
