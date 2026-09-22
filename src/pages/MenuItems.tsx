import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Coffee, EyeOff, Link2, Plus, Save, Search, Sparkles, Tags } from 'lucide-react'
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
type DraftMap = Record<string, ItemDraft>

const MENU_PAGE_SIZE = 50

// Statuses the server can only have produced before any metering ran, so the
// "no credits were charged" promise is safe to keep for them. A timeout or a
// dropped connection tells us nothing about whether the server finished.
const PRE_CHARGE_REJECTION_STATUSES = [400, 402, 403, 422, 429]

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

function responseStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status
  }
  return undefined
}

function buildDraft(item: SalesItem): ItemDraft {
  return {
    category: item.category,
    expectedPrice: item.expectedPrice == null ? '' : String(item.expectedPrice),
    priceTolerancePct: item.priceTolerancePct == null ? '10' : String(item.priceTolerancePct),
    aliases: (item.aliases ?? []).join(', '),
  }
}

function draftsEqual(a?: ItemDraft, b?: ItemDraft) {
  if (!a || !b) return false
  return (
    a.category === b.category &&
    a.expectedPrice === b.expectedPrice &&
    a.priceTolerancePct === b.priceTolerancePct &&
    a.aliases === b.aliases
  )
}

function draftPayload(draft: ItemDraft) {
  return {
    category: draft.category,
    expectedPrice: draft.expectedPrice === '' ? undefined : Number(draft.expectedPrice),
    priceTolerancePct: draft.priceTolerancePct === '' ? undefined : Number(draft.priceTolerancePct),
    aliases: draft.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
  }
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
  // "Use menu price X" collided with the "Menu price" field shown above it,
  // which holds the CURRENT price. This value is the proposed replacement.
  if (hasPriceIssue(item)) return `Change menu price to ${formatZar(suggestion.expectedPrice)}`
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
  const [savingAll, setSavingAll] = useState(false)
  const [creating, setCreating] = useState(false)
  const [aiReviewId, setAiReviewId] = useState<string | null>(null)
  const aiReviewKeysRef = useRef(new Map<string, string>())
  const [notice, setNotice] = useState<Notice>(null)
  const [query, setQuery] = useState('')
  const [menuPage, setMenuPage] = useState(1)
  const [mapTargets, setMapTargets] = useState<Record<string, string>>({})

  // `drafts` is what the user sees and edits. `baseline` is the server value
  // each draft was derived from, and it is what makes a row's dirtiness
  // knowable: a row is unsaved exactly when its draft differs from its
  // baseline. Refs mirror both so a refetch can merge synchronously without
  // reading stale closure state.
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [baseline, setBaseline] = useState<DraftMap>({})
  // Rows the user is still editing whose stored value moved underneath them.
  const [conflicts, setConflicts] = useState<DraftMap>({})
  const draftsRef = useRef<DraftMap>({})
  const baselineRef = useRef<DraftMap>({})

  const [newItem, setNewItem] = useState({ name: '', category: 'coffee' as SalesItemCategory, expectedPrice: '', priceTolerancePct: '10' })
  const canSpendCredits = user?.role === 'owner' || Boolean(user?.permissions?.canSpendCredits)

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 3500)
  }

  const applyDrafts = (next: DraftMap) => {
    draftsRef.current = next
    setDrafts(next)
  }
  const applyBaseline = (next: DraftMap) => {
    baselineRef.current = next
    setBaseline(next)
  }

  const draftFor = (item: SalesItem): ItemDraft => drafts[item._id] ?? buildDraft(item)

  const editDraft = (item: SalesItem, patch: Partial<ItemDraft>) => {
    const current = draftsRef.current[item._id] ?? buildDraft(item)
    applyDrafts({ ...draftsRef.current, [item._id]: { ...current, ...patch } })
  }

  // Marks one row as agreeing with the server again, so the next refetch is
  // free to take the server's value for it.
  const settleRow = (id: string, settled: ItemDraft) => {
    applyBaseline({ ...baselineRef.current, [id]: settled })
    setConflicts((current) => {
      if (!(id in current)) return current
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  const refresh = async ({ background = false }: { background?: boolean } = {}) => {
    // A post-mutation refetch must not blank the table into a spinner: the
    // remount scrolled the list back to the top and hid the fact that other
    // rows had reverted.
    if (!background) setLoading(true)
    setLoadError(false)
    try {
      const [menuRes, reviewRes] = await Promise.all([
        api.get<{ items: SalesItem[] }>('/items?active=true'),
        api.get<{ items: SalesItem[] }>('/items/reconciliation'),
      ])
      setItems(menuRes.data.items)
      setReviewItems(reviewRes.data.items)

      // Seed from both lists. Building only from the active-menu list dropped
      // every Fix-Imports draft, because a needs-review item is not in it.
      const serverDrafts: DraftMap = {}
      for (const item of [...reviewRes.data.items, ...menuRes.data.items]) {
        serverDrafts[item._id] = buildDraft(item)
      }

      const previousDrafts = draftsRef.current
      const previousBaseline = baselineRef.current
      const mergedDrafts: DraftMap = { ...serverDrafts }
      const nextBaseline: DraftMap = { ...previousBaseline }
      const nextConflicts: DraftMap = {}

      for (const [id, draft] of Object.entries(previousDrafts)) {
        const rowBaseline = previousBaseline[id]
        const serverDraft = serverDrafts[id]
        const isDirty = Boolean(rowBaseline) && !draftsEqual(draft, rowBaseline)
        if (!isDirty) continue

        // Conflict policy: the user's typing always wins the render, because
        // silently replacing what someone is mid-sentence on is the one
        // outcome with no recovery. Where the stored value also moved we say
        // so on the row and offer to take theirs, so the stale draft is never
        // kept silently either.
        mergedDrafts[id] = draft
        if (serverDraft && !draftsEqual(serverDraft, rowBaseline)) nextConflicts[id] = serverDraft
      }

      for (const [id, serverDraft] of Object.entries(serverDrafts)) {
        const draft = previousDrafts[id]
        const rowBaseline = previousBaseline[id]
        // The baseline stays pinned while a row is dirty, so the conflict on it
        // stays visible across later refetches instead of quietly resolving.
        const isDirty = Boolean(rowBaseline) && Boolean(draft) && !draftsEqual(draft, rowBaseline)
        if (!isDirty) nextBaseline[id] = serverDraft
      }

      applyDrafts(mergedDrafts)
      applyBaseline(nextBaseline)
      setConflicts(nextConflicts)
    } catch (err) {
      setLoadError(true)
      showNotice('error', apiError(err, 'Could not load menu items.'))
    } finally {
      if (!background) setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const matchedItems = useMemo(
    () => items.filter((item) => item.reviewStatus === 'matched' && item.isActive !== false),
    [items]
  )
  // Rendered once and reused by every review card. Building the list inside the
  // card map produced (review items x menu items) option nodes, which is 30k
  // nodes on a 300-item menu and re-created on every keystroke.
  const targetOptions = useMemo(
    () => matchedItems.map((target) => (
      <option key={target._id} value={target._id}>{target.name}</option>
    )),
    [matchedItems]
  )

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      (item.aliases ?? []).some((alias) => alias.toLowerCase().includes(q))
    )
  }, [items, query])

  const menuPages = Math.max(1, Math.ceil(filteredItems.length / MENU_PAGE_SIZE))
  const currentMenuPage = Math.min(menuPage, menuPages)
  const pagedItems = useMemo(
    () => filteredItems.slice((currentMenuPage - 1) * MENU_PAGE_SIZE, currentMenuPage * MENU_PAGE_SIZE),
    [filteredItems, currentMenuPage]
  )
  const menuRowStart = filteredItems.length === 0 ? 0 : (currentMenuPage - 1) * MENU_PAGE_SIZE + 1
  const menuRowEnd = Math.min(currentMenuPage * MENU_PAGE_SIZE, filteredItems.length)

  const dirtyIds = useMemo(
    () => Object.keys(drafts).filter((id) => baseline[id] && !draftsEqual(drafts[id], baseline[id])),
    [drafts, baseline]
  )
  const conflictCount = dirtyIds.filter((id) => conflicts[id]).length

  useEffect(() => {
    if (dirtyIds.length === 0) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtyIds.length])

  const createItem = async (event: FormEvent) => {
    event.preventDefault()
    if (creating) return
    if (!newItem.name.trim()) {
      showNotice('error', 'Give the menu item a name before adding it.')
      return
    }
    setCreating(true)
    try {
      await api.post('/items', {
        name: newItem.name.trim(),
        category: newItem.category,
        expectedPrice: newItem.expectedPrice === '' ? undefined : Number(newItem.expectedPrice),
        priceTolerancePct: newItem.priceTolerancePct === '' ? undefined : Number(newItem.priceTolerancePct),
      })
      setNewItem({ name: '', category: 'coffee', expectedPrice: '', priceTolerancePct: '10' })
      showNotice('success', 'Menu item added.')
      refresh({ background: true })
    } catch (err) {
      showNotice('error', apiError(err, 'Could not add menu item.'))
    } finally {
      setCreating(false)
    }
  }

  const putItem = async (item: SalesItem, draft: ItemDraft) => {
    await api.put(`/items/${item._id}`, {
      ...draftPayload(draft),
      reviewStatus: item.reviewStatus === 'needs_review' ? 'matched' : item.reviewStatus,
    })
    settleRow(item._id, draft)
  }

  const saveItem = async (item: SalesItem) => {
    const draft = drafts[item._id]
    if (!draft) return
    setSavingId(item._id)
    try {
      await putItem(item, draft)
      showNotice('success', 'Menu item saved.')
      refresh({ background: true })
    } catch (err) {
      showNotice('error', apiError(err, 'Could not save menu item.'))
    } finally {
      setSavingId(null)
    }
  }

  const saveAllDrafts = async () => {
    const pending = dirtyIds
      .map((id) => ({ item: items.find((candidate) => candidate._id === id), draft: drafts[id] }))
      .filter((entry): entry is { item: SalesItem; draft: ItemDraft } => Boolean(entry.item && entry.draft))
    if (pending.length === 0) return

    setSavingAll(true)
    let saved = 0
    let failed = 0
    for (const { item, draft } of pending) {
      try {
        await putItem(item, draft)
        saved += 1
      } catch {
        failed += 1
      }
    }
    setSavingAll(false)
    showNotice(
      failed === 0 ? 'success' : 'error',
      failed === 0
        ? `Saved ${saved} menu item${saved === 1 ? '' : 's'}.`
        : `Saved ${saved} of ${pending.length}. ${failed} could not be saved and ${failed === 1 ? 'is' : 'are'} still unsaved.`
    )
    refresh({ background: true })
  }

  const discardAllDrafts = () => {
    const next = { ...draftsRef.current }
    const nextBaseline = { ...baselineRef.current }
    for (const id of dirtyIds) {
      // Discarding takes the newest stored value, which for a conflicted row is
      // the one written while the user was typing.
      const stored = conflicts[id] ?? baselineRef.current[id]
      if (!stored) continue
      next[id] = stored
      nextBaseline[id] = stored
    }
    applyDrafts(next)
    applyBaseline(nextBaseline)
    setConflicts({})
  }

  const takeServerValue = (id: string) => {
    const serverDraft = conflicts[id]
    if (!serverDraft) return
    applyDrafts({ ...draftsRef.current, [id]: serverDraft })
    settleRow(id, serverDraft)
  }

  const resolveItem = async (item: SalesItem, action: 'confirm' | 'ignore' | 'map_to', priceOverride?: number) => {
    // An explicit blank choice means "none of these", so it must reach the
    // guard below. `||` folded it back into the AI's first candidate and linked
    // the POS item to the very suggestion the user had just rejected.
    const explicitTarget = mapTargets[item._id]
    const targetItemId = explicitTarget !== undefined ? explicitTarget : item.candidates?.[0]?.item?._id
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
      if (draft) settleRow(item._id, draft)
      showNotice('success', action === 'map_to' ? 'Item linked.' : action === 'ignore' ? 'Item ignored.' : 'Menu item updated.')
      refresh({ background: true })
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
      refresh({ background: true })
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
        // A free smart check is a correct, zero-cost outcome. Showing it as a
        // red error taught owners to distrust a result that was fine.
        showNotice('success', 'AI review was unavailable. A free smart check is shown and no credits were charged.')
      }
    } catch (err) {
      // Only a definite pre-charge rejection lets us promise the balance is
      // untouched. A timeout aborts the client, not the server, so the credit
      // may well have been spent on work we never saw.
      const status = responseStatus(err)
      const chargeIsKnown = status != null && PRE_CHARGE_REJECTION_STATUSES.includes(status)
      showNotice('error', apiError(
        err,
        chargeIsKnown
          ? 'Could not run the AI review. No credits were charged.'
          : 'We lost contact before this AI review was confirmed. Check your Guava credit balance before retrying.'
      ))
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
            <Button type="button" variant="outline" size="sm" onClick={() => refresh()}>Try again</Button>
          </div>
        )}

        {dirtyIds.length > 0 && (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-amber-200">
              {dirtyIds.length} unsaved change{dirtyIds.length === 1 ? '' : 's'} on this page.
              {conflictCount > 0 && ` ${conflictCount} of them changed elsewhere since you started.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={discardAllDrafts} disabled={savingAll}>
                Discard changes
              </Button>
              <Button type="button" size="sm" onClick={saveAllDrafts} disabled={savingAll}>
                <Save className="w-3.5 h-3.5" />
                {savingAll ? 'Saving…' : `Save all changes (${dirtyIds.length})`}
              </Button>
            </div>
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
                <Coffee className="w-5 h-5 text-guava-red-text" />
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
                    const draft = draftFor(item)
                    const priceIssue = hasPriceIssue(item)
                    const posPrice = suggestedPrice(item)
                    const suggestedMatch = item.reviewStatus === 'needs_review' ? item.candidates?.[0] : undefined
                    const aiSuggestion = item.aiSuggestion
                    const conflict = conflicts[item._id]
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
                              aria-label={`Category for ${item.name}`}
                              className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text"
                              value={draft.category}
                              onChange={(event) => editDraft(item, { category: event.target.value as SalesItemCategory })}
                            >
                              {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                            </select>
                            <Input
                              aria-label={`Menu price for ${item.name}`}
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft.expectedPrice}
                              onChange={(event) => editDraft(item, { expectedPrice: event.target.value })}
                              placeholder="Menu price"
                            />
                            <Button
                              aria-label={item.reviewStatus === 'needs_review'
                                ? `Keep ${item.name} as a new menu item`
                                : `Keep the menu price for ${item.name}`}
                              onClick={() => resolveItem(item, 'confirm')}
                              disabled={savingId === item._id}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {item.reviewStatus === 'needs_review' ? 'Keep as new item' : 'Keep menu price'}
                            </Button>
                            {priceIssue && posPrice != null && (
                              <Button
                                aria-label={`Use the POS price for ${item.name}`}
                                variant="outline"
                                onClick={() => resolveItem(item, 'confirm', posPrice)}
                                disabled={savingId === item._id}
                              >
                                Use POS price
                              </Button>
                            )}
                          </div>
                        </div>

                        {conflict && (
                          <ConflictNotice itemName={item.name} onTakeServer={() => takeServerValue(item._id)} />
                        )}

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2">
                          <p className="text-xs text-muted">
                            Smart checks are free. An AI review uses 1 Guava credit for this item.
                          </p>
                          <Button
                            aria-label={`Run AI review for ${item.name} (1 credit)`}
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
                              <Button
                                aria-label={`Approve the recommendation for ${item.name}`}
                                onClick={() => approveSuggestion(item)}
                                disabled={savingId === item._id}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                            </div>
                          </div>
                        )}

                        {item.reviewStatus === 'needs_review' && (
                          <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                            <select
                              aria-label={`Link ${item.name} to an existing menu item`}
                              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text"
                              value={mapTargets[item._id] ?? item.candidates?.[0]?.item?._id ?? ''}
                              onChange={(event) => setMapTargets((current) => ({ ...current, [item._id]: event.target.value }))}
                            >
                              <option value="">Link to existing menu item...</option>
                              {targetOptions}
                            </select>
                            <Button
                              aria-label={`Link ${item.name} to the selected menu item`}
                              variant="outline"
                              onClick={() => resolveItem(item, 'map_to')}
                              disabled={savingId === item._id}
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              Link
                            </Button>
                            <Button
                              aria-label={`Ignore the POS item ${item.name}`}
                              variant="ghost"
                              onClick={() => resolveItem(item, 'ignore')}
                              disabled={savingId === item._id}
                            >
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
                    <Label htmlFor="new-item-category">Category</Label>
                    <select id="new-item-category" className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text" value={newItem.category} onChange={(event) => setNewItem((current) => ({ ...current, category: event.target.value as SalesItemCategory }))}>
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
                  <Button type="submit" disabled={creating || !newItem.name.trim()}>
                    <Plus className="w-3.5 h-3.5" />
                    {creating ? 'Adding…' : 'Add'}
                  </Button>
                </form>

                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted" />
                  <Input
                    aria-label="Search menu items"
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setMenuPage(1) }}
                    placeholder="Search menu items"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted">
                    Showing {menuRowStart.toLocaleString('en-ZA')}-{menuRowEnd.toLocaleString('en-ZA')} of {filteredItems.length.toLocaleString('en-ZA')} menu items
                  </p>
                  {menuPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Previous menu page"
                        onClick={() => setMenuPage(Math.max(1, currentMenuPage - 1))}
                        disabled={currentMenuPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Next menu page"
                        onClick={() => setMenuPage(Math.min(menuPages, currentMenuPage + 1))}
                        disabled={currentMenuPage >= menuPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="overflow-auto rounded-lg border border-border">
                  <table className="w-full min-w-[980px] text-sm">
                    <caption className="sr-only">Menu items with their category, menu price, price alert threshold and POS aliases</caption>
                    <thead className="bg-[#111111] text-left text-xs uppercase tracking-wide text-[#9E9E9E]">
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
                      {pagedItems.map((item) => {
                        const draft = draftFor(item)
                        const conflict = conflicts[item._id]
                        return (
                          <tr key={item._id} className="border-t border-border">
                            <td className="px-3 py-3">
                              <div className="font-medium text-text">{item.name}</div>
                              <div className="mt-1"><StatusPill item={item} /></div>
                            </td>
                            <td className="px-3 py-3">
                              <select aria-label={`Category for ${item.name}`} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text" value={draft.category} onChange={(event) => editDraft(item, { category: event.target.value as SalesItemCategory })}>
                                {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <Input aria-label={`Menu price for ${item.name}`} className="w-28" type="number" min={0} step="0.01" value={draft.expectedPrice} onChange={(event) => editDraft(item, { expectedPrice: event.target.value })} />
                              {conflict && (
                                <ConflictNotice itemName={item.name} onTakeServer={() => takeServerValue(item._id)} />
                              )}
                            </td>
                            <td className="px-3 py-3 text-muted">{formatZar(item.avgPrice)}</td>
                            <td className="px-3 py-3">
                              <Input aria-label={`Price alert threshold for ${item.name}`} className="w-24" type="number" min={0} step="1" value={draft.priceTolerancePct} onChange={(event) => editDraft(item, { priceTolerancePct: event.target.value })} />
                            </td>
                            <td className="px-3 py-3">
                              <Input aria-label={`POS aliases for ${item.name}`} value={draft.aliases} onChange={(event) => editDraft(item, { aliases: event.target.value })} placeholder="POS name, another POS name" />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Button aria-label={`Save ${item.name}`} size="sm" variant="outline" onClick={() => saveItem(item)} disabled={savingId === item._id || savingAll}>
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

function ConflictNotice({ itemName, onTakeServer }: { itemName: string; onTakeServer: () => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5">
      <p className="text-xs text-amber-200">
        Changed on the server since you started editing. Saving replaces the stored value with yours.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Use the stored value for ${itemName} and discard this edit`}
        onClick={onTakeServer}
      >
        Use theirs
      </Button>
    </div>
  )
}
