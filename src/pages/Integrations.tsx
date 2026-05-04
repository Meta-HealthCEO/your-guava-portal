import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertCircle, RefreshCw, Unplug, Plug } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type SyncStatus = 'success' | 'failed' | null

interface ProviderState {
  connected: boolean
  connectedAt: string | null
  lastSyncAt: string | null
  lastSyncStatus: SyncStatus
  lastSyncError: string | null
}

interface IntegrationsData {
  xero: ProviderState
  quickbooks: ProviderState
  sage: ProviderState
}

type Provider = 'xero' | 'quickbooks' | 'sage'

interface SyncResult {
  success: boolean
  providerRef?: string
  summary?: { totalRevenue?: number; transactionCount?: number }
  message?: string
}

// ── Provider config ────────────────────────────────────────────────────────────

const PROVIDER_CONFIG: Record<
  Provider,
  {
    name: string
    description: string
    accentColor: string
    accentBg: string
    accentBorder: string
    bullets: string[]
  }
> = {
  xero: {
    name: 'Xero',
    description: 'Push daily sales summaries directly into your Xero accounting books.',
    accentColor: 'text-[#13B5EA]',
    accentBg: 'bg-[#13B5EA]/10',
    accentBorder: 'border-[#13B5EA]/25',
    bullets: [
      'Automatic bank transaction entries per sales period',
      'Reconcile coffee-shop revenue without manual exports',
      'Supports multi-organisation Xero accounts',
    ],
  },
  quickbooks: {
    name: 'QuickBooks',
    description: 'Sync sales totals and tax breakdowns with your QuickBooks Online company.',
    accentColor: 'text-[#2CA01C]',
    accentBg: 'bg-[#2CA01C]/10',
    accentBorder: 'border-[#2CA01C]/25',
    bullets: [
      'Map sales to QuickBooks income accounts automatically',
      'Daily or weekly summary entries with tax lines',
      'Supports multiple QuickBooks realms',
    ],
  },
  sage: {
    name: 'Sage Accounting',
    description: 'Post sales summaries to Sage Accounting for seamless bookkeeping.',
    accentColor: 'text-[#00C853]',
    accentBg: 'bg-[#00C853]/10',
    accentBorder: 'border-[#00C853]/25',
    bullets: [
      'Create journal entries from your daily revenue totals',
      'Keep your Sage ledger up to date without manual entry',
      'Supports Sage Business Cloud Accounting',
    ],
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function extractError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
    if (msg) return msg
  }
  if (err instanceof Error) return err.message
  return fallback
}

// ── StatusPill ────────────────────────────────────────────────────────────────

function StatusPill({ connected, syncStatus }: { connected: boolean; syncStatus: SyncStatus }) {
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3A3A3A] bg-[#2A2A2A] px-2.5 py-0.5 text-xs font-medium text-[#888888]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#555555]" />
        Not connected
      </span>
    )
  }
  if (syncStatus === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Sync failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4DA63B]/30 bg-[#4DA63B]/10 px-2.5 py-0.5 text-xs font-medium text-[#4DA63B]">
      <CheckCircle className="w-3 h-3" />
      Connected
    </span>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({
  provider,
  onConfirm,
  onCancel,
}: {
  provider: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <Unplug className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="text-[#F0F0F0] font-semibold text-sm">Disconnect {provider}?</p>
            <p className="text-[#777777] text-sm mt-1">
              You'll need to reconnect to sync sales data.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
            onClick={onConfirm}
          >
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── ProviderCard ──────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  state,
  onRefresh,
}: {
  provider: Provider
  state: ProviderState
  onRefresh: () => void
}) {
  const cfg = PROVIDER_CONFIG[provider]

  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { data } = await api.get<{ url: string }>(`/integrations/${provider}/auth`)
      window.location.href = data.url
    } catch (err) {
      setConnecting(false)
      console.error('[integrations] Failed to get auth URL:', extractError(err, 'Unknown error'))
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const { data } = await api.post<SyncResult>(`/integrations/${provider}/sync`)
      setSyncResult(data)
      onRefresh()
    } catch (err) {
      setSyncError(extractError(err, 'Sync failed.'))
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    setShowConfirm(false)
    setDisconnecting(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      await api.post(`/integrations/${provider}/disconnect`)
      onRefresh()
    } catch (err) {
      setSyncError(extractError(err, 'Disconnect failed.'))
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          provider={cfg.name}
          onConfirm={handleDisconnect}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div
        className={cn(
          'flex flex-col rounded-xl border bg-[#111111] p-5 gap-4',
          state.connected ? cfg.accentBorder : 'border-[#2A2A2A]'
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  cfg.accentBg
                )}
              >
                <Plug className={cn('w-3.5 h-3.5', cfg.accentColor)} />
              </div>
              <h3 className={cn('text-base font-semibold', cfg.accentColor)}>{cfg.name}</h3>
            </div>
            <p className="text-[#777777] text-sm leading-relaxed">{cfg.description}</p>
          </div>
          <StatusPill connected={state.connected} syncStatus={state.lastSyncStatus} />
        </div>

        {/* Connected state */}
        {state.connected ? (
          <div className="space-y-3">
            {/* Meta info */}
            <div className="rounded-lg bg-[#0F0F0F] border border-[#1E1E1E] px-3 py-2.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#555555]">Connected since</span>
                <span className="text-[#888888]">{formatDate(state.connectedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#555555]">Last sync</span>
                <span className="text-[#888888]">{formatDateTime(state.lastSyncAt)}</span>
              </div>
              {state.lastSyncStatus && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#555555]">Sync status</span>
                  {state.lastSyncStatus === 'success' ? (
                    <span className="text-[#4DA63B] flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Success
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Failed
                    </span>
                  )}
                </div>
              )}
              {state.lastSyncStatus === 'failed' && state.lastSyncError && (
                <p className="text-red-400 text-[11px] pt-0.5 border-t border-[#2A2A2A]">
                  {state.lastSyncError}
                </p>
              )}
            </div>

            {/* Inline sync feedback */}
            {syncResult?.success && syncResult.summary && (
              <div className="flex items-center gap-2 rounded-lg bg-[#4DA63B]/10 border border-[#4DA63B]/20 px-3 py-2 text-xs text-[#4DA63B]">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Sent{' '}
                  {syncResult.summary.totalRevenue != null
                    ? `R${syncResult.summary.totalRevenue.toLocaleString('en-ZA')}`
                    : '—'}
                  {syncResult.summary.transactionCount != null
                    ? ` (${syncResult.summary.transactionCount} txns)`
                    : ''}{' '}
                  to {cfg.name}
                </span>
              </div>
            )}
            {syncResult && !syncResult.success && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{syncResult.message || 'Sync did not complete.'}</span>
              </div>
            )}
            {syncError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{syncError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="bg-guava-green hover:bg-[#3d8e2e] text-white rounded-lg gap-1.5"
                onClick={handleSync}
                disabled={syncing || disconnecting}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
                {syncing ? 'Syncing…' : 'Sync now'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg text-[#888888] hover:text-red-400 hover:border-red-500/40"
                onClick={() => setShowConfirm(true)}
                disabled={syncing || disconnecting}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            </div>
          </div>
        ) : (
          /* Not-connected state */
          <div className="space-y-3">
            {/* What this enables */}
            <ul className="space-y-1.5">
              {cfg.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-[#666666]">
                  <span className={cn('mt-0.5 text-base leading-none', cfg.accentColor)}>•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            {/* Connect button */}
            <Button
              size="sm"
              className={cn(
                'rounded-lg text-white gap-1.5',
                cfg.accentBg,
                cfg.accentColor,
                'border',
                cfg.accentBorder,
                'hover:brightness-125'
              )}
              onClick={handleConnect}
              disabled={connecting}
            >
              <Plug className="w-3.5 h-3.5" />
              {connecting ? `Connecting to ${cfg.name}…` : `Connect ${cfg.name}`}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const EMPTY_STATE: IntegrationsData = {
  xero: { connected: false, connectedAt: null, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null },
  quickbooks: { connected: false, connectedAt: null, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null },
  sage: { connected: false, connectedAt: null, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null },
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState<IntegrationsData>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)

  const fetchIntegrations = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: IntegrationsData }>('/integrations')
      setIntegrations(data.data)
    } catch {
      // Non-fatal: keep empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  return (
    <AppLayout title="Integrations">
      <div className="space-y-6">
        {/* Page intro */}
        <div>
          <p className="text-[#777777] text-sm mt-1">
            Connect your accounting software to push sales summaries automatically.
          </p>
        </div>

        {/* Provider cards grid */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {(['xero', 'quickbooks', 'sage'] as Provider[]).map((p) => (
              <div
                key={p}
                className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-5 h-48 animate-[skeleton-shimmer_1.5s_ease-in-out_infinite]"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {(['xero', 'quickbooks', 'sage'] as Provider[]).map((p) => (
              <ProviderCard
                key={p}
                provider={p}
                state={integrations[p]}
                onRefresh={fetchIntegrations}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
