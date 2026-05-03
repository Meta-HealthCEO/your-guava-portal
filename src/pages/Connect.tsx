import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Link2,
  Clock,
  RefreshCw,
  Unplug,
  Loader2,
} from 'lucide-react'
import { ColumnMappingWizard } from '@/components/upload/ColumnMappingWizard'
import { UploadHistoryCard } from '@/components/upload/UploadHistoryCard'
import type { ColumnMapping, ItemsMode, StageUploadResponse } from '@/types/upload'
function extractErrorMsg(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
    if (msg) return msg
  }
  return fallback
}

import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import type { YocoStatus } from '@/types'

interface ImportResult {
  imported: number
  skipped: number
  total: number
  firstDate: string
  lastDate: string
}

interface SyncResult {
  imported: number
  skipped: number
  errors: number
  totalOrders: number
  dateRange: { start: string; end: string }
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

  // ── Yoco OAuth state ─────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams()
  const [yocoStatus, setYocoStatus] = useState<YocoStatus | null>(null)
  const [yocoLoading, setYocoLoading] = useState(true)
  const [yocoConnecting, setYocoConnecting] = useState(false)
  const [yocoSyncing, setYocoSyncing] = useState(false)
  const [yocoDisconnecting, setYocoDisconnecting] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [yocoError, setYocoError] = useState<string | null>(null)
  const [yocoSuccess, setYocoSuccess] = useState<string | null>(null)

  // ── Fetch Yoco connection status on mount ────────────────────────
  useEffect(() => {
    fetchYocoStatus()
  }, [])

  // ── Handle OAuth callback code in query params ───────────────────
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      // Remove query params from URL
      setSearchParams({}, { replace: true })
      handleOAuthCallback(code)
    }
  }, [searchParams])

  async function fetchYocoStatus() {
    try {
      setYocoLoading(true)
      const { data } = await api.get<{ success: boolean } & YocoStatus>('/yoco/status')
      setYocoStatus({
        connected: data.connected,
        lastSyncAt: data.lastSyncAt,
        tokenExpiresAt: data.tokenExpiresAt,
      })
    } catch {
      setYocoStatus({ connected: false, lastSyncAt: null, tokenExpiresAt: null })
    } finally {
      setYocoLoading(false)
    }
  }

  async function handleOAuthCallback(code: string) {
    try {
      setYocoConnecting(true)
      setYocoError(null)
      await api.post('/yoco/callback', { code })
      setYocoSuccess('Yoco connected successfully! Starting initial sync...')
      await fetchYocoStatus()

      // Trigger initial sync automatically
      await handleSync()
    } catch (err: unknown) {
      const msg = extractErrorMsg(err, '')
      setYocoError(msg || 'Failed to connect Yoco account. Please try again.')
    } finally {
      setYocoConnecting(false)
    }
  }

  async function handleConnectYoco() {
    try {
      setYocoError(null)
      const { data } = await api.get<{ success: boolean; url: string }>('/yoco/auth')
      window.location.href = data.url
    } catch (err: unknown) {
      const msg = extractErrorMsg(err, '')
      setYocoError(msg || 'Failed to start Yoco connection. Please try again.')
    }
  }

  async function handleSync() {
    try {
      setYocoSyncing(true)
      setYocoError(null)
      setSyncResult(null)
      setYocoSuccess(null)
      const { data } = await api.post<{ success: boolean } & SyncResult>('/yoco/sync')
      setSyncResult({
        imported: data.imported,
        skipped: data.skipped,
        errors: data.errors,
        totalOrders: data.totalOrders,
        dateRange: data.dateRange,
      })
      await fetchYocoStatus()
    } catch (err: unknown) {
      const msg = extractErrorMsg(err, '')
      setYocoError(msg || 'Sync failed. Please try again.')
    } finally {
      setYocoSyncing(false)
    }
  }

  async function handleDisconnect() {
    try {
      setYocoDisconnecting(true)
      setYocoError(null)
      setSyncResult(null)
      setYocoSuccess(null)
      await api.post('/yoco/disconnect')
      setYocoStatus({ connected: false, lastSyncAt: null, tokenExpiresAt: null })
    } catch (err: unknown) {
      const msg = extractErrorMsg(err, '')
      setYocoError(msg || 'Failed to disconnect. Please try again.')
    } finally {
      setYocoDisconnecting(false)
    }
  }

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {/* ── Yoco Live Integration Card ────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#D43D3D]" />
                <CardTitle>Yoco Live Integration</CardTitle>
              </div>
              {yocoStatus?.connected && <Badge variant="success">Connected</Badge>}
            </div>
            <CardDescription>
              Connect directly to your Yoco account for automatic transaction sync. No manual exports needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Loading state */}
            {yocoLoading && (
              <div className="flex items-center gap-2 text-sm text-[#555555]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking connection status...</span>
              </div>
            )}

            {/* OAuth callback in progress */}
            {yocoConnecting && (
              <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#D43D3D]/10 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-6 h-6 text-[#D43D3D] animate-spin" />
                </div>
                <p className="text-[#F0F0F0] font-medium mb-1">Connecting to Yoco...</p>
                <p className="text-[#555555] text-sm">Exchanging authorization tokens</p>
              </div>
            )}

            {/* Not connected */}
            {!yocoLoading && !yocoConnecting && !yocoStatus?.connected && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-[#2A2A2A]" />
                  <span className="text-[#555555]">Not connected</span>
                </div>

                <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-4">
                  <p className="text-[#888888] text-sm mb-3">
                    Connecting your Yoco account will automatically sync your transaction history and enable real-time updates whenever a new payment comes through.
                  </p>
                  <ul className="text-[#555555] text-xs space-y-1.5 mb-4">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-[#4DA63B] flex-shrink-0 mt-0.5" />
                      <span>Automatic daily transaction sync</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-[#4DA63B] flex-shrink-0 mt-0.5" />
                      <span>Real-time updates via webhooks</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-[#4DA63B] flex-shrink-0 mt-0.5" />
                      <span>No more manual CSV exports</span>
                    </li>
                  </ul>
                </div>

                <Button
                  variant="success"
                  className="w-full"
                  onClick={handleConnectYoco}
                >
                  <Link2 className="w-4 h-4" />
                  Connect Yoco Account
                </Button>
              </>
            )}

            {/* Connected state */}
            {!yocoLoading && !yocoConnecting && yocoStatus?.connected && (
              <>
                {/* Connection status */}
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-[#4DA63B]" />
                  <span className="text-[#4DA63B]">Connected to Yoco</span>
                </div>

                {/* Last sync info */}
                {yocoStatus.lastSyncAt && (
                  <div className="flex items-center gap-1.5 text-[#555555] text-xs">
                    <Clock className="w-3 h-3" />
                    <span>
                      Last synced: {new Date(yocoStatus.lastSyncAt).toLocaleString('en-ZA')}
                    </span>
                  </div>
                )}

                {/* Syncing state */}
                {yocoSyncing && (
                  <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#D43D3D]/10 flex items-center justify-center mx-auto mb-4">
                      <RefreshCw className="w-6 h-6 text-[#D43D3D] animate-spin" />
                    </div>
                    <p className="text-[#F0F0F0] font-medium mb-1">Syncing your Yoco transactions...</p>
                    <p className="text-[#555555] text-sm">This may take a moment depending on your transaction volume</p>
                  </div>
                )}

                {/* Sync result */}
                {syncResult && !yocoSyncing && (
                  <div className="bg-[#4DA63B]/5 border border-[#4DA63B]/20 rounded-xl p-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-[#4DA63B] flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[#F0F0F0] font-medium mb-1">Sync complete</p>
                        <p className="text-[#888888] text-sm mb-4">
                          {syncResult.totalOrders.toLocaleString()} orders processed from Yoco.
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-3 text-center">
                            <p className="text-[#4DA63B] text-xl font-bold">
                              {syncResult.imported.toLocaleString()}
                            </p>
                            <p className="text-[#555555] text-xs">imported</p>
                          </div>
                          <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-3 text-center">
                            <p className="text-[#888888] text-xl font-bold">
                              {syncResult.skipped.toLocaleString()}
                            </p>
                            <p className="text-[#555555] text-xs">skipped</p>
                          </div>
                          <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-3 text-center">
                            <p className="text-[#F0F0F0] text-xl font-bold">
                              {syncResult.totalOrders.toLocaleString()}
                            </p>
                            <p className="text-[#555555] text-xs">total orders</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success message (e.g. after initial connect) */}
                {yocoSuccess && !syncResult && !yocoSyncing && (
                  <div className="bg-[#4DA63B]/5 border border-[#4DA63B]/20 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#4DA63B] flex-shrink-0" />
                      <p className="text-[#4DA63B] text-sm">{yocoSuccess}</p>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {!yocoSyncing && (
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      onClick={handleSync}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Sync Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#555555]"
                      onClick={handleDisconnect}
                      disabled={yocoDisconnecting}
                    >
                      {yocoDisconnecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unplug className="w-4 h-4" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Error message */}
            {yocoError && (
              <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{yocoError}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

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
