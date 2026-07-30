import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle, Coffee, EyeOff, Link2, Plus, Save, Search, Sparkles, Tags } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import { publishGuavaCredits, type GuavaCreditSnapshot } from '@/lib/creditEvents'
import { secureRandomId } from '@/lib/idempotency'
import { cn } from '@/lib/utils'
import type { SalesItem, SalesItemCategory } from '@/types'

type Tab = 'review' | 'menu'
type Notice = { type: 'success' | 'error'; message: string } | null
type ItemDraft = { category: SalesItemCategory; expectedPrice: string; priceTolerancePct: string; aliases: string }

const CATEGORIES: { value: SalesItemCategory; label: string }[] = [
  { value: 'coffee', label: 'Coffee' },
  { value: 'cold_drink', label: 'Cold drink' },
  { value: 'food', label: 'Food' },
  { value: 'water', label: 'Water' },
  { value: 'retail', label: 'Retail' },
  { value: 'other', label: 'Other' },
]

function formatZar(value?: number) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `R${Number(value).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function apiError(err: unknown, fallback: string) {
  if (err && typeof err === 'object' && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
    if (msg) return msg
  }
  return fallback
}

function StatusPill({ item }: { item: SalesItem }) {
  const mismatch = (item.priceMismatchCount ?? 0) > 0 || Boolean(item.lastPriceMismatchAt)
  if (mismatch) return <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-300">Price differs</Badge>
  if (item.reviewStatus === 'needs_review') return <Badge className="border-red-500/25 bg-red-500/10 text-red-300">Needs a match</Badge>
  if (item.reviewStatus === 'ignored') return <Badge variant="secondary">Ignored</Badge>
  return <Badge variant="success">Ready</Badge>
}

function hasPriceIssue(item: SalesItem) {
  return (item.priceMismatchCount ?? 0) > 0 || Boolean(item.lastPriceMismatchAt)
}

function suggestedPrice(item: SalesItem) {
  return item.lastObservedPrice ?? item.avgPrice ?? item.observedPriceMax ?? item.observedPriceMin
}

function suggestionLabel(item: SalesItem) {
  const suggestion = item.aiSuggestion
  if (!suggestion) return ''
  if (suggestion.action === 'map_to') return `Link to ${suggestion.targetName || 'existing menu item'}`
  if (suggestion.action === 'ignore') return 'Ignore POS item'
  if (hasPriceIssue(item)) return `Use menu price ${formatZar(suggestion.expectedPrice)}`
  return 'Keep as new menu item'
}

export default function MenuItems() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('review')
  const [items, setItems] = useState<SalesItem[]>([])
  const [reviewItems, setReviewItems] = useState<SalesItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [aiReviewId, setAiReviewId] = useState<string | null>(null)
  const aiReviewKeysRef = useRef(new Map<string, string>())
  const [notice, setNotice] = useState<Notice>(null)
  const [query, setQuery] = useState('')
  const [mapTargets, setMapTargets] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({})
  const [newItem, setNewItem] = useState({ name: '', category: 'coffee' as SalesItemCategory, expectedPrice: '', priceTolerancePct: '10' })
  const canSpendCredits = user?.role === 'owner' || Boolean(user?.permissions?.canSpendCredits)

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 3500)
  }

  const refresh = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [menuRes, reviewRes] = await Promise.all([
        api.get<{ items: SalesItem[] }>('/items?active=true'),
        api.get<{ items: SalesItem[] }>('/items/reconciliation'),
      ])
      setItems(menuRes.data.items)
      setReviewItems(reviewRes.data.items)
      const nextDrafts: Record<string, ItemDraft> = {}
      menuRes.data.items.forEach((item) => {
        nextDrafts[item._id] = {
          category: item.category,
          expectedPrice: item.expectedPrice == null ? '' : String(item.expectedPrice),
          priceTolerancePct: item.priceTolerancePct == null ? '10' : String(item.priceTolerancePct),
          aliases: (item.aliases ?? []).join(', '),
        }
      })
      setDrafts(nextDrafts)
    } catch (err) {
      setLoadError(true)
      showNotice('error', apiError(err, 'Could not load menu items.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const matchedItems = useMemo(
    () => items.filter((item) => item.reviewStatus === 'matched' && item.isActive !== false),
    [items]
  )
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      (item.aliases ?? []).some((alias) => alias.toLowerCase().includes(q))
    )
  }, [items, query])

  const createItem = async (event: FormEvent) => {
    event.preventDefault()
    if (!newItem.name.trim()) return
    try {
      await api.post('/items', {
        name: newItem.name.trim(),
        category: newItem.category,
        expectedPrice: newItem.expectedPrice === '' ? undefined : Number(newItem.expectedPrice),
        priceTolerancePct: newItem.priceTolerancePct === '' ? undefined : Number(newItem.priceTolerancePct),
      })
      setNewItem({ name: '', category: 'coffee', expectedPrice: '', priceTolerancePct: '10' })
      showNotice('success', 'Menu item added.')
      refresh()
    } catch (err) {
      showNotice('error', apiError(err, 'Could not add menu item.'))
    }
  }

  const saveItem = async (item: SalesItem) => {
    const draft = drafts[item._id]
    if (!draft) return
    setSavingId(item._id)
    try {
      await api.put(`/items/${item._id}`, {
        category: draft.category,
        expectedPrice: draft.expectedPrice === '' ? undefined : Number(draft.expectedPrice),
        priceTolerancePct: draft.priceTolerancePct === '' ? undefined : Number(draft.priceTolerancePct),
        aliases: draft.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
        reviewStatus: item.reviewStatus === 'needs_review' ? 'matched' : item.reviewStatus,
      })
      showNotice('success', 'Menu item saved.')
      refresh()
    } catch (err) {
      showNotice('error', apiError(err, 'Could not save menu item.'))
    } finally {
      setSavingId(null)
    }
  }

  const resolveItem = async (item: SalesItem, action: 'confirm' | 'ignore' | 'map_to', priceOverride?: number) => {
    const targetItemId = mapTargets[item._id] || item.candidates?.[0]?.item?._id
    if (action === 'map_to' && !targetItemId) {
      showNotice('error', 'Choose a menu item to map to.')
      return
    }
    setSavingId(item._id)
    try {
      const draft = drafts[item._id]
      const expectedPriceValue = priceOverride == null
        ? draft?.expectedPrice ?? (item.expectedPrice == null ? '' : String(item.expectedPrice))
        : String(priceOverride)
      await api.post(`/items/${item._id}/resolve`, {
        action,
        targetItemId: action === 'map_to' ? targetItemId : undefined,
        category: draft?.category ?? item.category,
        expectedPrice: expectedPriceValue === '' ? undefined : Number(expectedPriceValue),
        aliases: draft?.aliases ? draft.aliases.split(',').map((alias) => alias.trim()).filter(Boolean) : item.aliases,
      })
      showNotice('success', action === 'map_to' ? 'Item linked.' : action === 'ignore' ? 'Item ignored.' : 'Menu item updated.')
      refresh()
    } catch (err) {
      showNotice('error', apiError(err, 'Could not update menu item.'))
    } finally {
      setSavingId(null)
    }
  }

  const approveSuggestion = async (item: SalesItem) => {
    const suggestion = item.aiSuggestion
    if (!suggestion) return
    if (suggestion.action === 'map_to' && !suggestion.targetItemId) {
      showNotice('error', 'This recommendation needs a menu item target before it can be approved.')
      return
    }
    setSavingId(item._id)
    try {
      await api.post(`/items/${item._id}/resolve`, {
        action: suggestion.action,
        targetItemId: suggestion.action === 'map_to' ? suggestion.targetItemId : undefined,
        category: suggestion.category ?? item.category,
        expectedPrice: suggestion.expectedPrice,
        aliases: suggestion.aliases,
        notes: suggestion.reason,
      })
      showNotice('success', 'Recommendation approved.')
      refresh()
    } catch (err) {
      showNotice('error', apiError(err, 'Could not approve this recommendation.'))
    } finally {
      setSavingId(null)
    }
  }

  const runAiReview = async (item: SalesItem) => {
    if (!canSpendCredits) {
      showNotice('error', 'Your role does not have permission to spend Guava credits.')
      return
    }

    setAiReviewId(item._id)
    const idempotencyKey =
      aiReviewKeysRef.current.get(item._id) || `menu-review:${secureRandomId()}`
    aiReviewKeysRef.current.set(item._id, idempotencyKey)
    try {
      const { data } = await api.post<{
        items: SalesItem[]
        guavaCredits?: GuavaCreditSnapshot
        meta?: { paidAiUsed?: boolean; creditsCharged?: number }
      }>(
        '/items/reconciliation/suggestions',
        { itemIds: [item._id] },
        {
          headers: { 'Idempotency-Key': idempotencyKey },
          timeout: 90_000,
        }
      )
      const reviewed = data.items?.[0]
      if (reviewed) {
        setReviewItems((current) =>
          current.map((candidate) => candidate._id === reviewed._id ? reviewed : candidate)
        )
      }
      aiReviewKeysRef.current.delete(item._id)
      publishGuavaCredits(data.guavaCredits)
      if (data.meta?.paidAiUsed) {
        showNotice(
          'success',
          `AI review complete. ${data.meta.creditsCharged ?? 1} Guava credit used.`
        )
      } else {
        showNotice('error', 'AI review was unavailable. A free smart check is shown and no credits were charged.')
      }
    } catch (err) {
      showNotice('error', apiError(err, 'Could not run the AI review. No credits were charged.'))
    } finally {
      setAiReviewId(null)
    }
  }

  const reviewCount = reviewItems.filter((item) => item.reviewStatus === 'needs_review').length
  const priceCount = reviewItems.filter(hasPriceIssue).length

  return (
    <AppLayout title="Menu Items">
      <div className="space-y-5">
        {notice && (
          <div role={notice.type === 'success' ? 'status' : 'alert'} className={cn(
            'flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm',
            notice.type === 'success'
              ? 'border-guava-green/20 bg-guava-green/10 text-guava-green'
              : 'border-red-900/30 bg-red-900/10 text-red-400'
          )}>
            {notice.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {notice.message}
          </div>
        )}

        {loadError && (
          <div className="flex flex-col gap-3 rounded-lg border border-red-900/30 bg-red-900/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-sm text-red-300">Menu items could not be loaded. Counts below are unavailable.</p>
            <Button type="button" variant="outline" size="sm" onClick={refresh}>Try again</Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-xs uppercase tracking-wide">Menu items</p>
                  <p className="text-text text-2xl font-bold">{loadError ? '—' : items.length}</p>
                </div>
                <Tags className="w-5 h-5 text-guava-green" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-xs uppercase tracking-wide">Need a match</p>
                  <p className="text-text text-2xl font-bold">{loadError ? '—' : reviewCount}</p>
                </div>
                <Coffee className="w-5 h-5 text-guava-red" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-xs uppercase tracking-wide">Price differences</p>
                  <p className="text-text text-2xl font-bold">{loadError ? '—' : priceCount}</p>
                </div>
                <AlertCircle className="w-5 h-5 text-amber-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Menu Items</CardTitle>
                <CardDescription>POS names, menu prices, and aliases.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant={tab === 'review' ? 'success' : 'outline'} size="sm" onClick={() => setTab('review')}>
                  <Coffee className="w-3.5 h-3.5" />
                  Fix Imports
                </Button>
                <Button variant={tab === 'menu' ? 'success' : 'outline'} size="sm" onClick={() => setTab('menu')}>
                  <Tags className="w-3.5 h-3.5" />
                  Menu Prices
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted py-8">Loading menu items...</div>
            ) : tab === 'review' ? (
              <div className="space-y-3">
                {reviewItems.length === 0 ? (
                  <div className="rounded-lg border border-border bg-[#111111] px-4 py-8 text-center text-sm text-muted">
                    No menu item issues to review.
                  </div>
                ) : (
                  reviewItems.map((item) => {
                    const draft = drafts[item._id] ?? {
                      category: item.category,
                      expectedPrice: item.expectedPrice == null ? '' : String(item.expectedPrice),
                      priceTolerancePct: item.priceTolerancePct == null ? '10' : String(item.priceTolerancePct),
                      aliases: (item.aliases ?? []).join(', '),
                    }
                    const priceIssue = hasPriceIssue(item)
                    const posPrice = suggestedPrice(item)
                    const suggestedMatch = item.reviewStatus === 'needs_review' ? item.candidates?.[0] : undefined
                    const aiSuggestion = item.aiSuggestion
                    return (
                      <div key={item._id} className="rounded-lg border border-border bg-[#111111] p-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="mb-1 text-xs uppercase tracking-wide text-muted">POS item</p>
                            <div className="flex items-center gap-2 mb-2">
                              <p className="truncate text-sm font-semibold text-text">{item.name}</p>
                              <StatusPill item={item} />
                            </div>
                            {suggestedMatch && (
                              <p className="mb-2 text-xs text-muted">
                                Suggested match <span className="text-text">{suggestedMatch.item.name}</span>
                              </p>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted">
                              <span>Sold {item.totalSold ?? 0}</span>
                              <span>POS average {formatZar(item.avgPrice)}</span>
                              <span>POS range {formatZar(item.observedPriceMin)} - {formatZar(item.observedPriceMax)}</span>
                              <span>Menu price {formatZar(item.expectedPrice)}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:w-[640px] gap-2">
                            <select
                              className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text"
                              value={draft.category}
                              onChange={(event) => setDrafts((current) => ({
                                ...current,
                                [item._id]: { ...draft, category: event.target.value as SalesItemCategory },
                              }))}
                            >
                              {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                            </select>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft.expectedPrice}
                              onChange={(event) => setDrafts((current) => ({
                                ...current,
                                [item._id]: { ...draft, expectedPrice: event.target.value },
                              }))}
                              placeholder="Menu price"
                            />
                            <Button onClick={() => resolveItem(item, 'confirm')} disabled={savingId === item._id}>
                              <CheckCircle className="w-3.5 h-3.5" />
                              {item.reviewStatus === 'needs_review' ? 'Keep as new item' : 'Keep menu price'}
                            </Button>
                            {priceIssue && posPrice != null && (
                              <Button variant="outline" onClick={() => resolveItem(item, 'confirm', posPrice)} disabled={savingId === item._id}>
                                Use POS price
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2">
                          <p className="text-xs text-muted">
                            Smart checks are free. An AI review uses 1 Guava credit for this item.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runAiReview(item)}
                            disabled={!canSpendCredits || aiReviewId === item._id}
                            title={!canSpendCredits ? 'Your role cannot spend Guava credits' : undefined}
                          >
                            <Sparkles className={cn('h-3.5 w-3.5', aiReviewId === item._id && 'animate-pulse')} />
                            {aiReviewId === item._id ? 'Reviewing...' : 'Run AI review (1 credit)'}
                          </Button>
                        </div>

                        {aiSuggestion && (
                          <div className="mt-3 rounded-lg border border-guava-green/20 bg-guava-green/10 p-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Sparkles className="h-3.5 w-3.5 text-guava-green" />
                                  <p className="text-sm font-semibold text-text">
                                    {aiSuggestion.source === 'ai' ? 'AI recommendation' : 'Smart recommendation'}
                                  </p>
                                  <Badge variant="secondary">{Math.round((aiSuggestion.confidence || 0) * 100)}% confidence</Badge>
                                  <Badge variant={aiSuggestion.source === 'ai' ? 'success' : 'secondary'}>
                                    {aiSuggestion.source === 'ai' ? 'AI' : 'Smart check'}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-sm text-text">{suggestionLabel(item)}</p>
                                <p className="mt-1 text-xs text-muted">{aiSuggestion.reason}</p>
                              </div>
                              <Button onClick={() => approveSuggestion(item)} disabled={savingId === item._id}>
                                <CheckCircle className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                            </div>
                          </div>
                        )}

                        {item.reviewStatus === 'needs_review' && (
                          <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                            <select
                              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text"
                              value={mapTargets[item._id] || item.candidates?.[0]?.item?._id || ''}
                              onChange={(event) => setMapTargets((current) => ({ ...current, [item._id]: event.target.value }))}
                            >
                              <option value="">Link to existing menu item...</option>
                              {matchedItems.filter((target) => target._id !== item._id).map((target) => (
                                <option key={target._id} value={target._id}>
                                  {target.name}
                                </option>
                              ))}
                            </select>
                            <Button variant="outline" onClick={() => resolveItem(item, 'map_to')} disabled={savingId === item._id}>
                              <Link2 className="w-3.5 h-3.5" />
                              Link
                            </Button>
                            <Button variant="ghost" onClick={() => resolveItem(item, 'ignore')} disabled={savingId === item._id}>
                              <EyeOff className="w-3.5 h-3.5" />
                              Ignore POS item
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <form onSubmit={createItem} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-[#111111] p-4 md:grid-cols-[1fr_170px_150px_130px_auto] md:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-item-name">Item name</Label>
                    <Input id="new-item-name" value={newItem.name} onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))} placeholder="Flat White" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <select className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text" value={newItem.category} onChange={(event) => setNewItem((current) => ({ ...current, category: event.target.value as SalesItemCategory }))}>
                      {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-item-price">Menu price</Label>
                    <Input id="new-item-price" type="number" min={0} step="0.01" value={newItem.expectedPrice} onChange={(event) => setNewItem((current) => ({ ...current, expectedPrice: event.target.value }))} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-item-threshold">Alert +/- %</Label>
                    <Input id="new-item-threshold" type="number" min={0} step="1" value={newItem.priceTolerancePct} onChange={(event) => setNewItem((current) => ({ ...current, priceTolerancePct: event.target.value }))} placeholder="10" />
                  </div>
                  <Button type="submit">
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </Button>
                </form>

                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search menu items" />
                </div>

                <div className="overflow-auto rounded-lg border border-border">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-[#111111] text-left text-xs uppercase tracking-wide text-[#777777]">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Menu price</th>
                        <th className="px-3 py-2">POS average</th>
                        <th className="px-3 py-2">Alert +/- %</th>
                        <th className="px-3 py-2">POS aliases</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => {
                        const draft = drafts[item._id] ?? {
                          category: item.category,
                          expectedPrice: item.expectedPrice == null ? '' : String(item.expectedPrice),
                          priceTolerancePct: item.priceTolerancePct == null ? '10' : String(item.priceTolerancePct),
                          aliases: (item.aliases ?? []).join(', '),
                        }
                        return (
                          <tr key={item._id} className="border-t border-border">
                            <td className="px-3 py-3">
                              <div className="font-medium text-text">{item.name}</div>
                              <div className="mt-1"><StatusPill item={item} /></div>
                            </td>
                            <td className="px-3 py-3">
                              <select className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text" value={draft.category} onChange={(event) => setDrafts((current) => ({ ...current, [item._id]: { ...draft, category: event.target.value as SalesItemCategory } }))}>
                                {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <Input className="w-28" type="number" min={0} step="0.01" value={draft.expectedPrice} onChange={(event) => setDrafts((current) => ({ ...current, [item._id]: { ...draft, expectedPrice: event.target.value } }))} />
                            </td>
                            <td className="px-3 py-3 text-muted">{formatZar(item.avgPrice)}</td>
                            <td className="px-3 py-3">
                              <Input className="w-24" type="number" min={0} step="1" value={draft.priceTolerancePct} onChange={(event) => setDrafts((current) => ({ ...current, [item._id]: { ...draft, priceTolerancePct: event.target.value } }))} />
                            </td>
                            <td className="px-3 py-3">
                              <Input value={draft.aliases} onChange={(event) => setDrafts((current) => ({ ...current, [item._id]: { ...draft, aliases: event.target.value } }))} placeholder="POS name, another POS name" />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Button size="sm" variant="outline" onClick={() => saveItem(item)} disabled={savingId === item._id}>
                                <Save className="w-3.5 h-3.5" />
                                Save
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
