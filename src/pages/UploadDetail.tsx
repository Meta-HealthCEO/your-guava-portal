import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, Download, Trash2, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ColumnMappingWizard } from '@/components/upload/ColumnMappingWizard'
import api from '@/lib/api'
import type { Upload, ColumnMapping, ItemsMode } from '@/types/upload'

interface Row {
  _id: string
  date: string
  total: number
  items: { name: string; quantity: number }[]
  receiptId?: string
}

interface RowsPagination {
  total: number
  page: number
  limit: number
  pages: number
}

const ROWS_LIMIT = 50
const DEFAULT_ROWS_PAGINATION: RowsPagination = {
  total: 0,
  page: 1,
  limit: ROWS_LIMIT,
  pages: 1,
}

const extractApiError = (err: unknown, fallback: string) => {
  if (err && typeof err === 'object' && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
    if (msg) return msg
  }
  return fallback
}

const normalisePagination = (
  pagination: Partial<RowsPagination> | undefined,
  fallbackPage: number,
  rowCount: number
): RowsPagination => {
  const limit = pagination?.limit || ROWS_LIMIT
  const total = pagination?.total ?? rowCount

  return {
    total,
    page: pagination?.page || fallbackPage,
    limit,
    pages: Math.max(pagination?.pages || Math.ceil(total / limit) || 1, 1),
  }
}

export default function UploadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [upload, setUpload] = useState<Upload | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string>('')
  const [rows, setRows] = useState<Row[]>([])
  const [rowsPagination, setRowsPagination] = useState<RowsPagination>(DEFAULT_ROWS_PAGINATION)
  const [tab, setTab] = useState<'rows' | 'file'>('rows')
  const [loading, setLoading] = useState(true)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [remapping, setRemapping] = useState(false)
  const [remapError, setRemapError] = useState<string | null>(null)

  const setRowsFromResponse = (
    data: { transactions: Row[]; pagination?: Partial<RowsPagination> },
    page: number
  ) => {
    setRows(data.transactions)
    setRowsPagination(normalisePagination(data.pagination, page, data.transactions.length))
  }

  const loadRowsPage = async (page: number) => {
    if (!id) return

    setRowsLoading(true)
    setRowsError(null)
    try {
      const rowsRes = await api.get<{ transactions: Row[]; pagination?: RowsPagination }>(`/uploads/${id}/rows`, {
        params: { page, limit: ROWS_LIMIT },
      })
      setRowsFromResponse(rowsRes.data, page)
    } catch (err: unknown) {
      setRowsError(extractApiError(err, 'Transactions could not be loaded.'))
    } finally {
      setRowsLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const loadUpload = async () => {
      setLoading(true)
      setRowsLoading(true)
      setRowsError(null)

      try {
        const [detail, rowsRes] = await Promise.all([
          api.get<{ upload: Upload; downloadUrl: string }>(`/uploads/${id}`),
          api.get<{ transactions: Row[]; pagination?: RowsPagination }>(`/uploads/${id}/rows`, {
            params: { page: 1, limit: ROWS_LIMIT },
          }),
        ])

        if (cancelled) return
        setUpload(detail.data.upload)
        setDownloadUrl(detail.data.downloadUrl)
        setRowsFromResponse(rowsRes.data, 1)
      } catch (err: unknown) {
        if (!cancelled) setRowsError(extractApiError(err, 'Upload details could not be loaded.'))
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRowsLoading(false)
        }
      }
    }

    loadUpload()

    return () => {
      cancelled = true
    }
  }, [id])

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.delete(`/uploads/${id}`)
      navigate('/data-health')
    } catch (err: unknown) {
      setDeleteError(extractApiError(err, 'Delete failed.'))
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <AppLayout title="Upload">
        <div className="flex items-center gap-2 text-sm text-[#555555]"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
      </AppLayout>
    )
  }

  if (!upload) {
    return <AppLayout title="Upload"><p>Not found.</p></AppLayout>
  }

  const rowStart = rowsPagination.total === 0 ? 0 : (rowsPagination.page - 1) * rowsPagination.limit + 1
  const rowEnd = Math.min(rowsPagination.page * rowsPagination.limit, rowsPagination.total)
  const showPagination = rowsPagination.total > rowsPagination.limit
  const rowsSummary = rowsLoading
    ? 'Loading transactions...'
    : rowsPagination.total === 0
      ? 'No imported transactions found for this upload.'
      : `Showing ${rowStart.toLocaleString('en-ZA')}-${rowEnd.toLocaleString('en-ZA')} of ${rowsPagination.total.toLocaleString('en-ZA')} imported transactions`

  return (
    <AppLayout title={upload.fileName}>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/data-health')}>
          <ArrowLeft className="w-4 h-4" /> Back to Data Health
        </Button>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>{upload.fileName}</CardTitle>
              <p className="text-sm text-muted mt-1">
                Uploaded {new Date(upload.createdAt).toLocaleString('en-ZA')} • {upload.posType}
              </p>
            </div>
            <Badge variant={upload.status === 'completed' ? 'success' : 'secondary'}>{upload.status}</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Imported" value={upload.stats.imported} />
              <Stat label="Skipped" value={upload.stats.skipped} />
              <Stat label="Errors" value={upload.stats.errors} />
              <Stat label="Total rows" value={upload.stats.totalRows} />
            </div>
            {upload.dateRange?.firstDate && (
              <p className="text-sm text-muted mt-3">
                Date range: {new Date(upload.dateRange.firstDate).toLocaleDateString('en-ZA')}
                {' → '}
                {new Date(upload.dateRange.lastDate!).toLocaleDateString('en-ZA')}
              </p>
            )}
            {downloadUrl && (
              <div className="mt-3">
                <a href={downloadUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" /> Download original file
                  </Button>
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant={tab === 'rows' ? 'success' : 'outline'} size="sm" onClick={() => setTab('rows')}>
            Transactions
          </Button>
          <Button variant={tab === 'file' ? 'success' : 'outline'} size="sm" onClick={() => setTab('file')}>
            Original file
          </Button>
        </div>

        {tab === 'rows' && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Transactions</CardTitle>
                <p className="text-sm text-muted mt-1">{rowsSummary}</p>
              </div>
              {rowsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
            </CardHeader>
            <CardContent className="space-y-4 overflow-auto">
              {rowsError ? (
                <div className="rounded-lg border border-red-900/30 bg-red-900/10 p-3 text-sm text-red-300">
                  <p>{rowsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => loadRowsPage(rowsPagination.page)}
                    disabled={rowsLoading}
                  >
                    Try again
                  </Button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#777777] text-xs">
                      <th className="py-2">Date</th>
                      <th>Receipt</th>
                      <th>Items</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r._id} className="border-t border-border">
                        <td className="py-2">{new Date(r.date).toLocaleString('en-ZA')}</td>
                        <td>{r.receiptId || '—'}</td>
                        <td>{(r.items ?? []).map((i) => `${i.quantity} × ${i.name}`).join(', ')}</td>
                        <td className="text-right">R{r.total?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {showPagination && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted">
                  <span>
                    Page {rowsPagination.page.toLocaleString('en-ZA')} of {rowsPagination.pages.toLocaleString('en-ZA')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Previous page"
                      onClick={() => loadRowsPage(rowsPagination.page - 1)}
                      disabled={rowsLoading || rowsPagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Next page"
                      onClick={() => loadRowsPage(rowsPagination.page + 1)}
                      disabled={rowsLoading || rowsPagination.page >= rowsPagination.pages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'file' && (
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted">Download the original file you uploaded.</p>
              <a href={downloadUrl} target="_blank" rel="noreferrer">
                <Button variant="success">
                  <Download className="w-4 h-4" /> Download {upload.fileName}
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        <div className="pt-4 border-t border-border">
          <Button variant="outline" size="sm" className="mr-2" onClick={() => setRemapping(true)}>
            Re-map columns
          </Button>
          {user?.role === 'owner' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-guava-red"
              onClick={() => {
                setDeleteError(null)
                setShowDeleteConfirm(true)
              }}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4" /> Delete this upload
            </Button>
          )}
          {deleteError && <p className="text-red-400 text-xs mt-2">{deleteError}</p>}
          {remapError && <p className="text-red-400 text-xs mt-2">{remapError}</p>}
        </div>
      </div>

      {remapping && upload && (
        <ColumnMappingWizard
          open
          headers={upload.headers || Object.values(upload.columnMapping).filter((v): v is string => typeof v === 'string')}
          preview={upload.sampleRows || []}
          initialMapping={upload.columnMapping}
          initialItemsMode={upload.itemsMode}
          onCancel={() => {
            setRemapError(null)
            setRemapping(false)
          }}
          onConfirm={async (mapping: ColumnMapping, itemsMode: ItemsMode) => {
            try {
              setRemapError(null)
              await api.patch(`/uploads/${id}/mapping`, { columnMapping: mapping, itemsMode })
              window.location.reload()
            } catch (err: unknown) {
              setRemapError(extractApiError(err, 'Re-map failed. Check the column choices and try again.'))
              setRemapping(false)
            }
          }}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-upload-title"
            className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg border border-red-900/40 bg-red-900/20 p-2 text-guava-red">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="delete-upload-title" className="text-lg font-semibold text-text">
                  Delete upload?
                </h2>
                <p className="mt-1 text-sm text-muted">
                  This will remove the linked transactions from {upload.fileName} and refresh the affected forecasts.
                  This cannot be undone.
                </p>
                {deleteError && (
                  <p className="mt-3 rounded-lg border border-red-900/30 bg-red-900/10 px-3 py-2 text-sm text-red-400">
                    {deleteError}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete upload
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#111111] border border-border rounded-lg p-3 text-center">
      <p className="text-text text-xl font-bold">{value}</p>
      <p className="text-[#555555] text-xs">{label}</p>
    </div>
  )
}
