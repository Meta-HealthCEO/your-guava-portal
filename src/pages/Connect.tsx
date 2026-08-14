import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react'
import { Upload, CheckCircle, AlertCircle, Clock, TrendingUp, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router'
import { ColumnMappingWizard } from '@/components/upload/ColumnMappingWizard'
import { UploadHistoryCard } from '@/components/upload/UploadHistoryCard'
import type {
  ColumnMapping,
  ItemsMode,
  StageUploadResponse,
  Upload as UploadRecord,
  UploadRowError,
} from '@/types/upload'

import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { addLocalDays, parseDateOnly, toLocalDateOnly } from '@/lib/date'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

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
  errors: number
  total: number
  firstDate: string
  lastDate: string
  rowErrors: UploadRowError[]
  maintenanceStatus?: 'not_started' | 'queued' | 'running' | 'completed' | 'partial_failure'
  replayed?: boolean
}

interface ConfirmUploadResponse {
  success: true
  uploadId: string
  stats: { imported: number; skipped: number; errors: number; totalRows: number }
  dateRange?: {
    firstDate?: string
    lastDate?: string
    firstDateKey?: string
    lastDateKey?: string
  }
  rowErrors?: UploadRowError[]
  maintenance?: UploadRecord['maintenance']
  replayed?: boolean
}

interface DataStatus {
  latestDataDate: string | null
  earliestDataDate: string | null
  daysSinceLatest: number | null
  totalTransactions: number
  coverage30d: { date: string; count: number }[]
}

type UploadPhase = 'uploading' | 'importing' | 'validating' | 'forecasting'

const uploadPhaseText: Record<UploadPhase, { title: string; detail: string; progress: number }> = {
  uploading: {
    title: 'Uploading file',
    detail: 'Sending your spreadsheet to Your Guava.',
    progress: 20,
  },
  importing: {
    title: 'Importing transactions',
    detail: 'Reading rows, skipping declined payments, and checking for duplicates.',
    progress: 55,
  },
  validating: {
    title: 'Validating menu items',
    detail: 'Matching POS item names and prices to your Menu Items.',
    progress: 75,
  },
  forecasting: {
    title: 'Refreshing forecasts',
    detail: 'Updating actuals and regenerating the next 7 days.',
    progress: 92,
  },
}

function ProcessingOverlay({ phase, progress }: { phase: UploadPhase; progress: number }) {
  const current = uploadPhaseText[phase]
  const pct = Math.max(current.progress, progress)
  const steps: UploadPhase[] = ['uploading', 'importing', 'validating', 'forecasting']
  const activeIndex = steps.indexOf(phase)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-guava-red/10">
            <LoaderCircle className="h-5 w-5 animate-spin text-guava-red-text" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text">{current.title}</p>
            <p className="mt-1 text-sm text-muted">{current.detail}</p>
          </div>
          <span className="text-xs font-semibold text-muted">{pct}%</span>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-guava-red transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-5 space-y-2">
          {steps.map((step, index) => {
            const done = index < activeIndex
            const active = index === activeIndex
            return (
              <div key={step} className="flex items-center gap-2 text-sm">
                {done ? (
                  <CheckCircle className="h-4 w-4 text-guava-green" />
                ) : active ? (
                  <LoaderCircle className="h-4 w-4 animate-spin text-guava-red-text" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-border" />
                )}
                <span className={cn(done || active ? 'text-text' : 'text-muted')}>
                  {uploadPhaseText[step].title}
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-5 text-xs text-muted">
          Large spreadsheets can take a little while. Keep this tab open until the import finishes.
        </p>
      </div>
    </div>
  )
}

// Build an array of 30 dates: [today-29, ..., today] as YYYY-MM-DD strings
function buildLast30Days(): string[] {
  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    days.push(toLocalDateOnly(addLocalDays(new Date(), -i)))
  }
  return days
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA')
}

function monthsSpan(earliest: string, latest: string): string {
  const e = parseDateOnly(earliest)
  const l = parseDateOnly(latest)
  const months = (l.getFullYear() - e.getFullYear()) * 12 + (l.getMonth() - e.getMonth())
  if (months <= 0) return '< 1 month'
  if (months === 1) return '1 month'
  return `${months} months`
}

function DataStatusCard({
  status,
  loading,
  error,
  onRetry,
  onUploadClick,
}: {
  status: DataStatus | null
  loading: boolean
  error: boolean
  onRetry: () => void
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
      pillColor = 'bg-guava-green/20 text-guava-green border-guava-green/30'
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
          <TrendingUp className="w-4 h-4 text-guava-red-text" />
          <CardTitle>Data Status</CardTitle>
        </div>
        <CardDescription>How fresh is your uploaded transaction data?</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted text-sm py-2">
            <div className="w-4 h-4 border-2 border-[#555555]/30 border-t-[#555555] rounded-full animate-spin" />
            Checking data status…
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-3 py-2" role="alert">
            <div>
              <p className="text-sm font-medium text-red-300">Data status is unavailable</p>
              <p className="mt-1 text-xs text-muted">Guava could not verify freshness. Your uploaded data has not been removed.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Left: status */}
            <div className="flex-1 min-w-0">
              <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium mb-2', pillColor)}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {statusLabel}
              </div>
              <p className="text-[#9E9E9E] text-sm truncate">{statusSubtitle}</p>
            </div>

            {/* Middle: 30-day coverage strip */}
            <div className="shrink-0">
              <p className="text-muted text-xs mb-1.5">Last 30 days</p>
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
  const [dataStatusError, setDataStatusError] = useState(false)

  // ── CSV Upload state ─────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error' | 'duplicate'>('idle')
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('uploading')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastUpload, setLastUpload] = useState<string | null>(null)
  const [stageResponse, setStageResponse] = useState<StageUploadResponse | null>(null)
  const [stageErrorMsg, setStageErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const confirmationKeysRef = useRef(new Map<string, string>())

  const confirmationKeyFor = (uploadId: string) => {
    const existing = confirmationKeysRef.current.get(uploadId)
    if (existing) return existing
    const generated = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    confirmationKeysRef.current.set(uploadId, generated)
    return generated
  }

  const recoverCompletedConfirmation = async (
    uploadId: string,
    originalError: unknown
  ): Promise<ConfirmUploadResponse> => {
    const status = originalError && typeof originalError === 'object' && 'response' in originalError
      ? (originalError as { response?: { status?: number } }).response?.status
      : undefined
    if (status != null && ![408, 504].includes(status)) throw originalError

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { data } = await api.get<{ upload: UploadRecord }>(`/uploads/${uploadId}`, {
          timeout: 10_000,
        })
        if (data.upload.status === 'completed') {
          return {
            success: true,
            uploadId,
            stats: data.upload.stats,
            dateRange: data.upload.dateRange,
            rowErrors: data.upload.rowErrors,
            maintenance: data.upload.maintenance,
            replayed: true,
          }
        }
        if (data.upload.status !== 'parsing') break
      } catch {
        // A transient status-read failure should not hide a commit that may
        // already have succeeded. Retry within this short bounded window.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
    }
    throw originalError
  }

  const confirmUpload = async (
    uploadId: string,
    columnMapping: ColumnMapping,
    itemsMode: ItemsMode,
    allowPartialImport = false
  ): Promise<ConfirmUploadResponse> => {
    try {
      const { data } = await api.post<ConfirmUploadResponse>(
        `/uploads/${uploadId}/confirm`,
        { columnMapping, itemsMode, allowPartialImport },
        {
          timeout: 120_000,
          headers: { 'Idempotency-Key': confirmationKeyFor(uploadId) },
        }
      )
      return data
    } catch (error) {
      const response = error && typeof error === 'object' && 'response' in error
        ? (error as {
            response?: {
              status?: number
              data?: { details?: { errors?: number; totalRows?: number } }
            }
          }).response
        : undefined
      if (response?.status === 422 && !allowPartialImport) {
        const failed = response.data?.details?.errors
        const total = response.data?.details?.totalRows
        const proceed = window.confirm(
          `${failed ?? 'Many'} of ${total ?? 'the'} rows could not be imported. ` +
          'Import only the valid rows anyway? You can review the rejected-row report afterward.'
        )
        if (proceed) return confirmUpload(uploadId, columnMapping, itemsMode, true)
        throw error
      }
      return recoverCompletedConfirmation(uploadId, error)
    }
  }

  const finishConfirmation = (confirmed: ConfirmUploadResponse) => {
    setResult({
      imported: confirmed.stats.imported,
      skipped: confirmed.stats.skipped,
      errors: confirmed.stats.errors,
      total: confirmed.stats.totalRows,
      firstDate: confirmed.dateRange?.firstDateKey ?? confirmed.dateRange?.firstDate ?? '',
      lastDate: confirmed.dateRange?.lastDateKey ?? confirmed.dateRange?.lastDate ?? '',
      rowErrors: confirmed.rowErrors || [],
      maintenanceStatus: confirmed.maintenance?.status,
      replayed: confirmed.replayed,
    })
    setUploadState('success')
    setHistoryRefreshKey((key) => key + 1)
    setLastUpload(new Date().toISOString())
  }

  // ── Fetch data status ────────────────────────────────────────────
  const fetchDataStatus = async (signal?: AbortSignal) => {
    try {
      setDataStatusLoading(true)
      setDataStatusError(false)
      const { data } = await api.get<{ success: boolean; data: DataStatus }>('/transactions/status', { signal })
      setDataStatus(data.data)
    } catch {
      if (!signal?.aborted) {
        setDataStatus(null)
        setDataStatusError(true)
      }
    } finally {
      if (!signal?.aborted) setDataStatusLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchDataStatus(controller.signal)
    return () => controller.abort()
  }, [historyRefreshKey])

  // ── CSV Upload handlers ──────────────────────────────────────────
  const handleFile = async (file: File) => {
  const validTypes = [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
  const lowerName = file.name.toLowerCase()
  const validExt = lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx')

  if (!validTypes.includes(file.type) && !validExt) {
      setErrorMsg('Invalid file type. Please upload a .csv or .xlsx file.')
      setUploadState('error')
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorMsg('File is too large. Please upload a file under 10 MB.')
      setUploadState('error')
      return
    }

    setUploadState('uploading')
    setUploadPhase('uploading')
    setProgress(0)
    setErrorMsg(null)
    setResult(null)
    setStageErrorMsg(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data } = await api.post<StageUploadResponse>('/transactions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.min(35, Math.round((e.loaded / e.total) * 35)))
        },
      })
      if (data.needsConfirmation) {
        setStageResponse(data)
        setStageErrorMsg(null)
        setUploadState('idle')
      } else {
        // Auto-confirm any POS file with a complete preset or saved mapping.
        setUploadPhase('importing')
        setProgress(55)
        setTimeout(() => {
          setUploadPhase('validating')
          setProgress(75)
        }, 600)
        const confirmed = await confirmUpload(
          data.uploadId,
          data.columnMapping,
          data.itemsMode
        )
        setUploadPhase('forecasting')
        setProgress(95)
        finishConfirmation(confirmed)
      }
    } catch (err: unknown) {
      const msg = extractErrorMsg(err, 'Upload failed. Please try again.')
      setErrorMsg(msg)
      // Re-importing a file you already uploaded is normal housekeeping, not a
      // failure. The rows were skipped because they are already safely stored.
      setUploadState(/already exist/i.test(msg) ? 'duplicate' : 'error')
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
    setStageErrorMsg(null)
    setProgress(0)
    setUploadPhase('uploading')
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  // Detect whether any of the uploaded date range is in the past
  const actualsWereFilled = result?.firstDate
    ? parseDateOnly(result.firstDate) < parseDateOnly(toLocalDateOnly(new Date()))
    : false

  const importedDaysCount =
    result?.firstDate && result?.lastDate
      ? Math.max(
          1,
          Math.round(
            (parseDateOnly(result.lastDate).getTime() - parseDateOnly(result.firstDate).getTime()) /
              86400000
          ) + 1
        )
      : null

  return (
    <AppLayout title="Data Health">
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
          error={dataStatusError}
          onRetry={() => fetchDataStatus()}
          onUploadClick={openFilePicker}
        />

        {/* ── Upload Card ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-guava-red-text" />
              <CardTitle>Upload Sales Data</CardTitle>
            </div>
            <CardDescription>
              Upload a POS CSV or XLSX export. Unknown formats can use AI-assisted mapping when permitted;
              a new AI mapping uses 10 Guava Credits.
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
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openFilePicker()
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Choose a sales CSV or XLSX file to upload"
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                  isDragging
                    ? 'border-guava-red bg-guava-red/5'
                    : 'border-border hover:border-[#3A3A3A] hover:bg-white/[0.02]'
                )}
              >
                <div className="w-12 h-12 rounded-xl bg-[#111111] border border-border flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6 text-muted" />
                </div>
                <p className="text-text font-medium mb-1">
                  Drop your sales CSV or XLSX here
                </p>
                <p className="text-muted text-sm">
                  or{' '}
                  <span className="text-guava-red-text hover:underline">click to browse</span>
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Badge variant="secondary">.csv</Badge>
                  <Badge variant="secondary">.xlsx</Badge>
                </div>
              </div>
            )}

            {/* Upload progress */}
            {uploadState === 'uploading' && (
              <div className="bg-[#111111] border border-border rounded-xl p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-guava-red/10 flex items-center justify-center mx-auto mb-4">
                  <LoaderCircle className="w-6 h-6 text-guava-red-text animate-spin" />
                </div>
                <p className="text-text font-medium mb-1">{uploadPhaseText[uploadPhase].title}</p>
                <p className="text-muted text-sm mb-4">{uploadPhaseText[uploadPhase].detail}</p>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-guava-red rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(uploadPhaseText[uploadPhase].progress, progress)}%` }}
                  />
                </div>
                <p className="text-muted text-xs mt-2">{Math.max(uploadPhaseText[uploadPhase].progress, progress)}%</p>
              </div>
            )}

            {/* Success */}
            {uploadState === 'success' && result && (
              <div className="bg-guava-green/5 border border-guava-green/20 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-guava-green shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-text font-medium mb-1">
                      {result.errors > 0 ? 'Import completed with rejected rows' : 'Import successful'}
                    </p>
                    <p className="text-muted text-sm mb-4">
                      Your committed transaction data is safe. Forecast maintenance continues in the background when needed.
                    </p>
                    {result.replayed && (
                      <p className="mb-4 rounded-lg border border-guava-green/20 bg-guava-green/5 px-3 py-2 text-xs text-guava-green">
                        The original response was interrupted, so this completed import was recovered from server status.
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-[#111111] border border-border rounded-lg p-3 text-center">
                        <p className="text-guava-green text-xl font-bold">{result.imported.toLocaleString()}</p>
                        <p className="text-muted text-xs">imported</p>
                      </div>
                      <div className="bg-[#111111] border border-border rounded-lg p-3 text-center">
                        <p className="text-muted text-xl font-bold">{result.skipped.toLocaleString()}</p>
                        <p className="text-muted text-xs">skipped</p>
                      </div>
                      <div className="bg-[#111111] border border-border rounded-lg p-3 text-center">
                        <p className={cn('text-xl font-bold', result.errors > 0 ? 'text-amber-300' : 'text-muted')}>
                          {result.errors.toLocaleString()}
                        </p>
                        <p className="text-muted text-xs">rejected</p>
                      </div>
                      <div className="bg-[#111111] border border-border rounded-lg p-3 text-center">
                        <p className="text-text text-xl font-bold">{result.total.toLocaleString()}</p>
                        <p className="text-muted text-xs">total rows</p>
                      </div>
                    </div>
                    {result.firstDate && result.lastDate && (
                      <p className="text-muted text-xs mb-4">
                        Date range: {parseDateOnly(result.firstDate).toLocaleDateString('en-ZA')} → {parseDateOnly(result.lastDate).toLocaleDateString('en-ZA')}
                      </p>
                    )}
                    {result.errors > 0 && (
                      <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3" role="status">
                        <p className="text-sm font-medium text-amber-200">
                          {result.errors.toLocaleString()} row{result.errors === 1 ? '' : 's'} {result.errors === 1 ? 'was' : 'were'} not imported
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Review Upload History for up to the first 50 rejected-row details.
                        </p>
                        {result.rowErrors.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs text-amber-100">
                            {result.rowErrors.slice(0, 5).map((rowError, index) => (
                              <li key={`${rowError.rowNumber ?? 'row'}-${index}`}>
                                {rowError.rowNumber ? `Row ${rowError.rowNumber}: ` : ''}{rowError.reason}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
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
                            <span className="text-guava-red-text mt-0.5">•</span>
                            <span>
                              Filled actuals for past days — see{' '}
                              <Link to="/planning" className="text-guava-red-text hover:underline">
                                Planning - Last week's results
                              </Link>
                            </span>
                          </li>
                        )}
                        <li className="flex items-start gap-2 text-muted text-sm">
                          <span className="text-guava-green mt-0.5">•</span>
                          <span>
                            {result.maintenanceStatus === 'completed'
                              ? 'Refreshed forecast inputs and the next planning week'
                              : 'Queued a durable forecast and actuals refresh'}
                          </span>
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

            {/* Already imported - a no-op, not a failure */}
            {uploadState === 'duplicate' && (
              <div className="bg-surface border border-border rounded-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle className="w-5 h-5 text-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-text font-medium mb-1">Already up to date</p>
                    <p className="text-muted text-sm">
                      Every row in this file was imported previously, so nothing changed.
                      Your existing data is untouched.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>
                  Upload a different file
                </Button>
              </div>
            )}

            {/* Error */}
            {uploadState === 'error' && (
              <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-text font-medium mb-1">Upload failed</p>
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
              <div className="flex items-center gap-1.5 text-muted text-xs">
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
          errorMessage={stageErrorMsg}
          assistiveNotice={
            stageResponse.mappingAssistedByAi
              ? stageResponse.mappingCreditsUsed
                ? `AI suggested the preselected column matches and used ${stageResponse.mappingCreditsUsed} Guava Credits. Review every match before importing.`
                : 'AI suggested the preselected column matches without a new credit charge. Review every match before importing.'
              : null
          }
          onCancel={() => {
            setStageResponse(null)
            setStageErrorMsg(null)
          }}
          onConfirm={async (mapping: ColumnMapping, itemsMode: ItemsMode) => {
            try {
              setUploadState('uploading')
              setUploadPhase('importing')
              setProgress(55)
              setStageErrorMsg(null)
              setTimeout(() => {
                setUploadPhase('validating')
                setProgress(75)
              }, 600)
              const confirmed = await confirmUpload(
                stageResponse.uploadId,
                mapping,
                itemsMode
              )
              setUploadPhase('forecasting')
              setProgress(95)
              finishConfirmation(confirmed)
              setStageResponse(null)
              setStageErrorMsg(null)
            } catch (err: unknown) {
              const msg = extractErrorMsg(err, 'Confirm failed. Check the column choices and try again.')
              setErrorMsg(msg)
              setStageErrorMsg(msg)
              setUploadState('error')
            }
          }}
        />
      )}
      {uploadState === 'uploading' && <ProcessingOverlay phase={uploadPhase} progress={progress} />}
    </AppLayout>
  )
}
