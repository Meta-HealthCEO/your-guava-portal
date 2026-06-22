import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnMapping, ItemsMode } from '@/types/upload'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const CANONICAL_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'date', label: 'Date', required: true },
  { key: 'items', label: 'Items / Description', required: true },
  { key: 'total', label: 'Total amount', required: true },
  { key: 'time', label: 'Time', required: false },
  { key: 'receiptId', label: 'Receipt ID', required: false },
  { key: 'tip', label: 'Tip', required: false },
  { key: 'discount', label: 'Discount', required: false },
  { key: 'paymentMethod', label: 'Payment method', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'quantity', label: 'Quantity (line-per-row mode)', required: false },
]

interface Props {
  open: boolean
  headers: string[]
  preview: Record<string, string>[]
  initialMapping: ColumnMapping
  initialItemsMode: ItemsMode
  errorMessage?: string | null
  onConfirm: (mapping: ColumnMapping, itemsMode: ItemsMode) => void | Promise<void>
  onCancel: () => void
}

export function ColumnMappingWizard({
  open,
  headers,
  preview,
  initialMapping,
  initialItemsMode,
  errorMessage,
  onConfirm,
  onCancel,
}: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping)
  const [itemsMode, setItemsMode] = useState<ItemsMode>(initialItemsMode)
  const [isConfirming, setIsConfirming] = useState(false)
  const mountedRef = useRef(true)
  const receiptRequired = itemsMode === 'line-per-row'

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const requiredOk = useMemo(
    () => Boolean(mapping.date && mapping.items && mapping.total && (!receiptRequired || mapping.receiptId)),
    [mapping, receiptRequired]
  )
  const receiptRequirementMessage = receiptRequired && !mapping.receiptId
    ? 'Receipt ID is required for line-per-row imports.'
    : null

  if (!open) return null

  const setField = (key: keyof ColumnMapping, value: string | undefined) =>
    setMapping((m) => ({ ...m, [key]: value || undefined }))

  const handleConfirm = async () => {
    if (!requiredOk || isConfirming) return
    setIsConfirming(true)
    try {
      await onConfirm(mapping, itemsMode)
    } finally {
      if (mountedRef.current) setIsConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-auto">
      <Card className="max-w-3xl w-full">
        <CardHeader>
          <CardTitle>Map your CSV columns</CardTitle>
          <p className="text-sm text-muted">
            We couldn't auto-detect your file format. Match each canonical field on the left to the
            column from your CSV on the right. Required fields are marked with *.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {CANONICAL_FIELDS.map(({ key, label, required }) => {
              const fieldRequired = required || (key === 'receiptId' && receiptRequired)
              return (
                <div key={key} className="contents">
                  <label className="text-sm text-text self-center">
                    {label}{fieldRequired && <span className="text-guava-red"> *</span>}
                  </label>
                  <select
                    className="bg-[#111111] border border-border rounded-lg px-2 py-1 text-sm"
                    value={mapping[key] || ''}
                    onChange={(e) => setField(key, e.target.value)}
                  >
                  <option value="">— none —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>

          <div>
            <label className="text-sm text-text mr-3">Items mode:</label>
            <select
              className="bg-[#111111] border border-border rounded-lg px-2 py-1 text-sm"
              value={itemsMode}
              onChange={(e) => setItemsMode(e.target.value as ItemsMode)}
            >
              <option value="packed">Packed (one row per receipt)</option>
              <option value="line-per-row">Line-per-row (one row per item)</option>
            </select>
          </div>

          {preview.length > 0 && (
            <div className="text-xs text-[#777777]">
              <p className="mb-2">Preview (first {preview.length} rows):</p>
              <div className="overflow-auto max-h-48 border border-border rounded-lg">
                <table className="text-xs w-full">
                  <thead className="bg-[#111111]">
                    <tr>{headers.map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {headers.map((h) => <td key={h} className="px-2 py-1">{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {receiptRequirementMessage && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {receiptRequirementMessage}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg border border-red-900/30 bg-red-900/10 px-3 py-2 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button
              variant="success"
              disabled={!requiredOk || isConfirming}
              onClick={handleConfirm}
            >
              {isConfirming ? 'Importing...' : 'Confirm and import'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
