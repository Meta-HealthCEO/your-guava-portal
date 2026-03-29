import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import { Upload, CheckCircle, AlertCircle, Link2, Key, Clock } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface ImportResult {
  imported: number
  skipped: number
  total: number
  firstDate: string
  lastDate: string
}

export default function Connect() {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastUpload, setLastUpload] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const { data } = await api.post<ImportResult>('/transactions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      setResult(data)
      setUploadState('success')
      setLastUpload(new Date().toISOString())
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
      setErrorMsg(msg ?? 'Upload failed. Please check your file and try again.')
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
      <div className="max-w-2xl space-y-6">
        {/* ── Upload Card ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#D43D3D]" />
              <CardTitle>Upload Yoco Data</CardTitle>
            </div>
            <CardDescription>
              Export your transaction history from the Yoco dashboard and upload it here. Supports CSV and XLSX.
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
                  Drop your Yoco CSV or XLSX here
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
                    <p className="text-[#555555] text-xs">
                      Date range: {result.firstDate} → {result.lastDate}
                    </p>
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
        <Card className="opacity-75">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#555555]" />
                <CardTitle className="text-[#888888]">Yoco Live Integration</CardTitle>
              </div>
              <Badge variant="warning">Coming Soon</Badge>
            </div>
            <CardDescription>
              Connect directly to your Yoco account for real-time transaction sync. No manual exports needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-[#2A2A2A]" />
              <span className="text-[#555555]">Not connected</span>
            </div>

            {/* API Key input */}
            <div className="space-y-1.5">
              <Label htmlFor="yoco-api-key" className="text-[#555555]">
                Yoco API Key
              </Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#3A3A3A]" />
                <Input
                  id="yoco-api-key"
                  type="password"
                  placeholder="sk_live_••••••••••••••••"
                  className="pl-9 opacity-50 cursor-not-allowed"
                  disabled
                />
              </div>
            </div>

            <Button disabled className="w-full opacity-40 cursor-not-allowed">
              <Link2 className="w-4 h-4" />
              Connect Yoco Account
            </Button>

            <p className="text-[#3A3A3A] text-xs">
              Live integration will enable automatic daily sync of your transactions, removing the need to manually export and upload CSV files.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
