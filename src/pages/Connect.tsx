import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import { Upload, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { ColumnMappingWizard } from '@/components/upload/ColumnMappingWizard'
import { UploadHistoryCard } from '@/components/upload/UploadHistoryCard'
import type { ColumnMapping, ItemsMode, StageUploadResponse } from '@/types/upload'

import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

function extractErrorMsg(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
    if (msg) return msg
  }
  return fallback
}

interface ImportResult {
  imported: number
  skipped: number
  total: number
  firstDate: string
  lastDate: string
}

export default function Connect() {
  // ── CSV Upload state ─────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastUpload, setLastUpload] = useState<string | null>(null)
  const [stageResponse, setStageResponse] = useState<StageUploadResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── CSV Upload handlers ──────────────────────────────────────────
  const handleFile = async (file: File) => {
    const validTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    const validExt = file.name.endsWith('.csv') || file.name.endsWith('.xlsx')

    if (!validTypes.includes(file.type) && !validExt) {
      setErrorMsg('Invalid file type. Please upload a .csv or .xlsx file.')
      setUploadState('error')
      return
    }

    setUploadState('uploading')
    setProgress(0)
    setErrorMsg(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data } = await api.post<StageUploadResponse>('/transactions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      if (data.needsConfirmation) {
        setStageResponse(data)
        setUploadState('idle')
      } else {
        // Auto-confirm Yoco or any POS file with a complete saved/AI mapping.
        const confirmRes = await api.post<{ stats: { imported: number; skipped: number; errors: number; totalRows: number }; dateRange?: { firstDate?: string; lastDate?: string } }>(
          `/uploads/${data.uploadId}/confirm`,
          { columnMapping: data.columnMapping, itemsMode: data.itemsMode }
        )
        setResult({
          imported: confirmRes.data.stats.imported,
          skipped: confirmRes.data.stats.skipped,
          total: confirmRes.data.stats.totalRows,
          firstDate: confirmRes.data.dateRange?.firstDate ?? '',
          lastDate: confirmRes.data.dateRange?.lastDate ?? '',
        })
        setUploadState('success')
        setHistoryRefreshKey((k) => k + 1)
        setLastUpload(new Date().toISOString())
      }
    } catch (err: unknown) {
      const msg = extractErrorMsg(err, '')
      setErrorMsg(msg ?? 'Upload failed.')
      setUploadState('error')
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const reset = () => {
    setUploadState('idle')
    setResult(null)
    setErrorMsg(null)
    setProgress(0)
  }

  return (
    <AppLayout title="Connect Data">
      <div className="space-y-6">
        {/* ── Upload Card ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#D43D3D]" />
              <CardTitle>Upload Sales Data</CardTitle>
            </div>
            <CardDescription>
              Upload a Yoco export or another POS CSV/XLSX. Unknown formats are mapped automatically when possible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            {uploadState === 'idle' && (
              <div
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                  isDragging
                    ? 'border-[#D43D3D] bg-[#D43D3D]/5'
                    : 'border-[#2A2A2A] hover:border-[#3A3A3A] hover:bg-white/[0.02]'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={onFileChange}
                />
                <div className="w-12 h-12 rounded-xl bg-[#111111] border border-[#2A2A2A] flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6 text-[#555555]" />
                </div>
                <p className="text-[#F0F0F0] font-medium mb-1">
                  Drop your sales CSV or XLSX here
                </p>
                <p className="text-[#555555] text-sm">
                  or{' '}
                  <span className="text-[#D43D3D] hover:underline">click to browse</span>
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Badge variant="secondary">.csv</Badge>
                  <Badge variant="secondary">.xlsx</Badge>
                </div>
              </div>
            )}

            {/* Upload progress */}
            {uploadState === 'uploading' && (
              <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#D43D3D]/10 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6 text-[#D43D3D] animate-bounce" />
                </div>
                <p className="text-[#F0F0F0] font-medium mb-1">Uploading...</p>
                <p className="text-[#555555] text-sm mb-4">Processing your transaction data</p>
                <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D43D3D] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[#555555] text-xs mt-2">{progress}%</p>
              </div>
            )}

            {/* Success */}
            {uploadState === 'success' && result && (
              <div className="bg-[#4DA63B]/5 border border-[#4DA63B]/20 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#4DA63B] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[#F0F0F0] font-medium mb-1">Import successful</p>
                    <p className="text-[#888888] text-sm mb-4">
                      Your transaction data has been processed and forecasts are being generated.
                    </p>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-3 text-center">
                        <p className="text-[#4DA63B] text-xl font-bold">{result.imported.toLocaleString()}</p>
                        <p className="text-[#555555] text-xs">imported</p>
                      </div>
                      <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-3 text-center">
                        <p className="text-[#888888] text-xl font-bold">{result.skipped.toLocaleString()}</p>
                        <p className="text-[#555555] text-xs">skipped</p>
                      </div>
                      <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-3 text-center">
                        <p className="text-[#F0F0F0] text-xl font-bold">{result.total.toLocaleString()}</p>
                        <p className="text-[#555555] text-xs">total rows</p>
                      </div>
                    </div>
                    {result.firstDate && result.lastDate && (
                      <p className="text-[#555555] text-xs">
                        Date range: {new Date(result.firstDate).toLocaleDateString('en-ZA')} → {new Date(result.lastDate).toLocaleDateString('en-ZA')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="secondary" size="sm" onClick={reset}>
                    Upload another file
                  </Button>
                </div>
              </div>
            )}

            {/* Error */}
            {uploadState === 'error' && (
              <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#F0F0F0] font-medium mb-1">Upload failed</p>
                    <p className="text-red-400 text-sm">{errorMsg}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>
                  Try again
                </Button>
              </div>
            )}

            {/* Last upload timestamp */}
            {lastUpload && uploadState !== 'uploading' && (
              <div className="flex items-center gap-1.5 text-[#555555] text-xs">
                <Clock className="w-3 h-3" />
                <span>Last upload: {new Date(lastUpload).toLocaleString('en-ZA')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <UploadHistoryCard refreshKey={historyRefreshKey} />
      </div>

      {stageResponse && (
        <ColumnMappingWizard
          open
          headers={stageResponse.headers}
          preview={stageResponse.preview}
          initialMapping={stageResponse.columnMapping}
          initialItemsMode={stageResponse.itemsMode}
          onCancel={() => setStageResponse(null)}
          onConfirm={async (mapping: ColumnMapping, itemsMode: ItemsMode) => {
            try {
              const res = await api.post<{ stats: { imported: number; skipped: number; errors: number; totalRows: number }; dateRange?: { firstDate?: string; lastDate?: string } }>(
                `/uploads/${stageResponse.uploadId}/confirm`,
                { columnMapping: mapping, itemsMode }
              )
              setResult({
                imported: res.data.stats.imported,
                skipped: res.data.stats.skipped,
                total: res.data.stats.totalRows,
                firstDate: res.data.dateRange?.firstDate ?? '',
                lastDate: res.data.dateRange?.lastDate ?? '',
              })
              setUploadState('success')
              setHistoryRefreshKey((k) => k + 1)
              setLastUpload(new Date().toISOString())
            } catch (err: unknown) {
              setErrorMsg(extractErrorMsg(err, 'Confirm failed.'))
              setUploadState('error')
            } finally {
              setStageResponse(null)
            }
          }}
        />
      )}
    </AppLayout>
  )
}
