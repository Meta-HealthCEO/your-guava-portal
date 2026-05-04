import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react'
import { Upload, CheckCircle, AlertCircle, Clock, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
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

interface DataStatus {
  latestDataDate: string | null
  earliestDataDate: string | null
  daysSinceLatest: number | null
  totalTransactions: number
  coverage30d: { date: string; count: number }[]
}

// Build an array of 30 dates: [today-29, ..., today] as YYYY-MM-DD strings
function buildLast30Days(): string[] {
  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA')
}

function monthsSpan(earliest: string, latest: string): string {
  const e = new Date(earliest)
  const l = new Date(latest)
  const months = (l.getFullYear() - e.getFullYear()) * 12 + (l.getMonth() - e.getMonth())
  if (months <= 0) return '< 1 month'
  if (months === 1) return '1 month'
  return `${months} months`
}

function DataStatusCard({
  status,
  loading,
  onUploadClick,
}: {
  status: DataStatus | null
  loading: boolean
  onUploadClick: () => void
}) {
  const days30 = buildLast30Days()
  const coverageMap = new Map<string, number>()
  status?.coverage30d.forEach((c) => coverageMap.set(c.date, c.count))

  const daysSince = status?.daysSinceLatest ?? null
  let pillColor = 'bg-red-500/20 text-red-400 border-red-500/30'
  let statusLabel = 'No data uploaded yet'
  let statusSubtitle = 'Upload your first sales CSV or XLSX to get started.'

  if (!loading && status && status.latestDataDate) {
    if (daysSince !== null && daysSince < 2) {
      pillColor = 'bg-[#4DA63B]/20 text-[#4DA63B] border-[#4DA63B]/30'
      statusLabel = 'Data is up to date'
    } else if (daysSince !== null && daysSince <= 7) {
      pillColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      statusLabel = `Data is ${daysSince} day${daysSince === 1 ? '' : 's'} behind`
    } else {
      pillColor = 'bg-red-500/20 text-red-400 border-red-500/30'
      statusLabel = daysSince !== null ? `Data is ${daysSince} days behind` : 'Data status unknown'
    }

    const txLabel = status.totalTransactions.toLocaleString() + ' transactions'
    const span = status.earliestDataDate
      ? monthsSpan(status.earliestDataDate, status.latestDataDate)
      : ''
    statusSubtitle = `Latest: ${formatDate(status.latestDataDate)} · ${txLabel}${span ? ` across ${span}` : ''}`
  }

  const isActionNeeded = !status?.latestDataDate || (daysSince !== null && daysSince >= 2)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#D43D3D]" />
          <CardTitle>Data Status</CardTitle>
        </div>
        <CardDescription>How fresh is your uploaded transaction data?</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-[#555555] text-sm py-2">
            <div className="w-4 h-4 border-2 border-[#555555]/30 border-t-[#555555] rounded-full animate-spin" />
            Checking data status…
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Left: status */}
            <div className="flex-1 min-w-0">
              <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium mb-2', pillColor)}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {statusLabel}
              </div>
              <p className="text-[#777777] text-sm truncate">{statusSubtitle}</p>
            </div>

            {/* Middle: 30-day coverage strip */}
            <div className="shrink-0">
              <p className="text-[#555555] text-xs mb-1.5">Last 30 days</p>
              <div className="flex gap-0.5" role="list" aria-label="30-day data coverage">
                {days30.map((day) => {
                  const count = coverageMap.get(day)
                  const hasData = count !== undefined && count > 0
                  return (
                    <div
                      key={day}
                      role="listitem"
                      title={hasData ? `${formatDate(day)}: ${count} transactions` : `${formatDate(day)}: no data`}
                      className={cn(
                        'w-3 h-6 rounded-sm cursor-default',
                        hasData ? 'bg-guava-red' : 'bg-border'
                      )}
                    />
                  )
                })}
              </div>
            </div>

            {/* Right: action */}
            <div className="shrink-0">
              {isActionNeeded ? (
                <Button
                  size="sm"
                  className="bg-guava-green hover:bg-[#3d8e2e] text-white rounded-lg"
                  onClick={onUploadClick}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload latest data
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-guava-green text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Up to date
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Connect() {
  // ── Data status state ────────────────────────────────────────────
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null)
  const [dataStatusLoading, setDataStatusLoading] = useState(true)

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

  // ── Fetch data status ────────────────────────────────────────────
  const fetchDataStatus = async () => {
    try {
      setDataStatusLoading(true)
      const { data } = await api.get<{ success: boolean; data: DataStatus }>('/transactions/status')
      setDataStatus(data.data)
    } catch {
      // Non-fatal: leave status null
    } finally {
      setDataStatusLoading(false)
    }
  }

  useEffect(() => {
    fetchDataStatus()
  }, [historyRefreshKey])

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

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  // Detect whether any of the uploaded date range is in the past
  const actualsWereFilled = result?.firstDate
    ? new Date(result.firstDate) < new Date(new Date().toISOString().slice(0, 10))
    : false

  const importedDaysCount =
    result?.firstDate && result?.lastDate
      ? Math.max(
          1,
          Math.round(
            (new Date(result.lastDate).getTime() - new Date(result.firstDate).getTime()) /
              86400000
          ) + 1
        )
      : null

  return (
    <AppLayout title="Connect Data">
      <div className="space-y-6">
        {/* Hidden file input (shared between Data Status card CTA and Upload card) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={onFileChange}
        />

        {/* ── Data Status Card ──────────────────────────────────────────── */}
        <DataStatusCard
          status={dataStatus}
          loading={dataStatusLoading}
          onUploadClick={openFilePicker}
        />

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
                onClick={openFilePicker}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                  isDragging
                    ? 'border-[#D43D3D] bg-[#D43D3D]/5'
                    : 'border-[#2A2A2A] hover:border-[#3A3A3A] hover:bg-white/[0.02]'
                )}
              >
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
                      <p className="text-[#555555] text-xs mb-4">
                        Date range: {new Date(result.firstDate).toLocaleDateString('en-ZA')} → {new Date(result.lastDate).toLocaleDateString('en-ZA')}
                      </p>
                    )}

                    {/* What this did */}
                    <div className="bg-[#111111] border border-border rounded-lg p-3 mb-4">
                      <p className="text-muted text-xs font-medium mb-2 uppercase tracking-wide">What this did</p>
                      <ul className="space-y-1.5">
                        <li className="flex items-start gap-2 text-muted text-sm">
                          <span className="text-guava-green mt-0.5">•</span>
                          <span>
                            Imported {result.imported.toLocaleString()} transactions
                            {importedDaysCount ? ` covering ${importedDaysCount} day${importedDaysCount === 1 ? '' : 's'}` : ''}
                          </span>
                        </li>
                        {actualsWereFilled && (
                          <li className="flex items-start gap-2 text-muted text-sm">
                            <span className="text-guava-red mt-0.5">•</span>
                            <span>
                              Filled actuals for past days — see{' '}
                              <Link to="/forecasts" className="text-guava-red hover:underline">
                                Forecasts → Last week's results
                              </Link>
                            </span>
                          </li>
                        )}
                        <li className="flex items-start gap-2 text-muted text-sm">
                          <span className="text-guava-green mt-0.5">•</span>
                          <span>Updated next 7-day forecasts using fresh data</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
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
