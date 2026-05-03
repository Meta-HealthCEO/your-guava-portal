import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import UploadDetail from './UploadDetail'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { role: 'owner' }, isLoading: false, isOwner: true }),
}))

const apiMock = api as unknown as { get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

describe('UploadDetail', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
    apiMock.delete.mockReset()
  })

  it('renders upload metadata and a download link', async () => {
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
    render(
      <MemoryRouter initialEntries={["/uploads/u1"]}>
        <Routes>
          <Route path="/uploads/:id" element={<UploadDetail />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('export.csv')).toBeInTheDocument())
    expect(screen.getByText(/imported/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute('href', 'https://test.r2.local/foo')
  })
})
