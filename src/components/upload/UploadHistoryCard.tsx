import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, FileText, ExternalLink, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import type { Upload } from '@/types/upload'

const statusColor: Record<string, 'success' | 'secondary' | 'destructive'> = {
  completed: 'success',
  pending_mapping: 'secondary',
  parsing: 'secondary',
  failed: 'destructive',
}

interface UploadHistoryCardProps {
  refreshKey?: number
}

export function UploadHistoryCard({ refreshKey = 0 }: UploadHistoryCardProps) {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.get<{ success: boolean; uploads: Upload[] }>('/uploads')
      .then(({ data }) => { if (active) setUploads(data.uploads) })
      .catch(() => { if (active) setUploads([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshKey])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#D43D3D]" />
          <CardTitle>Upload history</CardTitle>
        </div>
        <CardDescription>
          Every CSV/XLSX you've imported. Click an entry to view the imported rows or download the original file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[#555555]">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        )}
        {!loading && uploads.length === 0 && (
          <p className="text-sm text-[#555555]">No uploads yet. Drop a CSV in the card above to get started.</p>
        )}
        {!loading && uploads.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#777777] text-xs">
                  <th className="py-2">File</th>
                  <th>POS</th>
                  <th>Imported</th>
                  <th>Date range</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u._id} className="border-t border-[#2A2A2A]">
                    <td className="py-2 flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-[#777777]" />{u.fileName}</td>
                    <td>{u.posType}</td>
                    <td>{u.stats.imported}</td>
                    <td className="text-[#888888]">
                      {u.dateRange?.firstDate ? new Date(u.dateRange.firstDate).toLocaleDateString('en-ZA') : '—'}
                      {' → '}
                      {u.dateRange?.lastDate ? new Date(u.dateRange.lastDate).toLocaleDateString('en-ZA') : '—'}
                    </td>
                    <td><Badge variant={statusColor[u.status] || 'secondary'}>{u.status}</Badge></td>
                    <td className="text-[#888888]">{new Date(u.createdAt).toLocaleString('en-ZA')}</td>
                    <td>
                      <Link to={`/uploads/${u._id}`} className="text-[#D43D3D] hover:underline inline-flex items-center gap-1">
                        View <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
