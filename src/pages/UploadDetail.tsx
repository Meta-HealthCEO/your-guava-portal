import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, Download, Trash2, ArrowLeft } from 'lucide-react'
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

export default function UploadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [upload, setUpload] = useState<Upload | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string>('')
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'rows' | 'file'>('rows')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [remapping, setRemapping] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<{ upload: Upload; downloadUrl: string }>(`/uploads/${id}`),
      api.get<{ transactions: Row[] }>(`/uploads/${id}/rows`),
    ])
      .then(([detail, rowsRes]) => {
        setUpload(detail.data.upload)
        setDownloadUrl(detail.data.downloadUrl)
        setRows(rowsRes.data.transactions)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!confirm('Delete this upload? Linked transactions will be removed.')) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.delete(`/uploads/${id}`)
      navigate('/connect')
    } catch (err: unknown) {
      let msg = 'Delete failed.'
      if (err && typeof err === 'object' && 'response' in err) {
        const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message
        if (m) msg = m
      }
      setDeleteError(msg)
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

  return (
    <AppLayout title={upload.fileName}>
      <div className="max-w-4xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/connect')}>
          <ArrowLeft className="w-4 h-4" /> Back to Connect
        </Button>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>{upload.fileName}</CardTitle>
              <p className="text-sm text-[#888888] mt-1">
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
              <p className="text-sm text-[#888888] mt-3">
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
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#777777] text-xs">
                    <th className="py-2">Date</th>
                    <th>Receipt</th>
                    <th>Items</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id} className="border-t border-[#2A2A2A]">
                      <td className="py-2">{new Date(r.date).toLocaleString('en-ZA')}</td>
                      <td>{r.receiptId || '—'}</td>
                      <td>{(r.items ?? []).map((i) => `${i.quantity} × ${i.name}`).join(', ')}</td>
                      <td>R{r.total?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {tab === 'file' && (
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm text-[#888888]">Download the original file you uploaded.</p>
              <a href={downloadUrl} target="_blank" rel="noreferrer">
                <Button variant="success">
                  <Download className="w-4 h-4" /> Download {upload.fileName}
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        <div className="pt-4 border-t border-[#2A2A2A]">
          <Button variant="outline" size="sm" className="mr-2" onClick={() => setRemapping(true)}>
            Re-map columns
          </Button>
          {user?.role === 'owner' && (
            <Button variant="ghost" size="sm" className="text-[#D43D3D]" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="w-4 h-4" /> Delete this upload
            </Button>
          )}
          {deleteError && <p className="text-red-400 text-xs mt-2">{deleteError}</p>}
        </div>
      </div>

      {remapping && upload && (
        <ColumnMappingWizard
          open
          headers={upload.headers || Object.values(upload.columnMapping).filter((v): v is string => typeof v === 'string')}
          preview={upload.sampleRows || []}
          initialMapping={upload.columnMapping}
          initialItemsMode={upload.itemsMode}
          onCancel={() => setRemapping(false)}
          onConfirm={async (mapping: ColumnMapping, itemsMode: ItemsMode) => {
            try {
              await api.patch(`/uploads/${id}/mapping`, { columnMapping: mapping, itemsMode })
              window.location.reload()
            } catch {
              setRemapping(false)
            }
          }}
        />
      )}
    </AppLayout>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-3 text-center">
      <p className="text-[#F0F0F0] text-xl font-bold">{value}</p>
      <p className="text-[#555555] text-xs">{label}</p>
    </div>
  )
}
