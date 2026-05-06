import { useEffect, useState, type ComponentType, type FormEvent } from 'react'
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Edit3,
  KeyRound,
  Mail,
  MapPin,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import type { TeamMember, CafeBasic } from '@/types'

type ToastState = { type: 'success' | 'error'; message: string } | null
type SeatSummary = { plan: string; used: number; included: number; remaining: number }

function generateTempPassword() {
  return `Guava-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm',
        toast.type === 'success'
          ? 'border-guava-green/20 bg-guava-green/10 text-guava-green'
          : 'border-red-900/30 bg-red-900/10 text-red-400'
      )}
    >
      {toast.type === 'success' ? (
        <CheckCircle className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      <span>{toast.message}</span>
    </div>
  )
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  icon: ComponentType<{ className?: string }>
  tone?: 'neutral' | 'good' | 'warn'
}) {
  const toneClass = {
    neutral: 'bg-surface-2 text-muted',
    good: 'bg-guava-green/10 text-guava-green',
    warn: 'bg-guava-red/10 text-guava-red',
  }[tone]

  return (
    <div className="rounded-lg border border-border bg-[#111111] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-text">{value}</p>
          {sub && <p className="mt-1 truncate text-xs text-[#666666]">{sub}</p>}
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  children: React.ReactNode
  footer: React.ReactNode
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-text"
            aria-label={`Close ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        <div className="flex justify-end gap-2 border-t border-border p-5">{footer}</div>
      </div>
    </div>
  )
}

function CafeAccessPicker({
  cafes,
  selectedIds,
  onToggle,
}: {
  cafes: CafeBasic[]
  selectedIds: string[]
  onToggle: (cafeId: string) => void
}) {
  if (cafes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-[#111111] px-3 py-4 text-sm text-[#666666]">
        No cafe locations yet.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {cafes.map((cafe) => {
        const checked = selectedIds.includes(cafe._id)
        return (
          <label
            key={cafe._id}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
              checked
                ? 'border-guava-red/50 bg-guava-red/10 text-text'
                : 'border-border bg-[#111111] text-muted hover:border-[#3A3A3A] hover:text-text'
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(cafe._id)}
              className="h-4 w-4 rounded border-[#333333] bg-[#111111] text-guava-red focus:ring-guava-red focus:ring-offset-0"
            />
            <span className="truncate text-sm">{cafe.name}</span>
          </label>
        )
      })}
    </div>
  )
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-border text-sm font-semibold text-text">
      {initials || '?'}
    </div>
  )
}

export default function Team() {
  const { isOwner } = useAuth()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [cafes, setCafes] = useState<CafeBasic[]>([])
  const [seats, setSeats] = useState<SeatSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastState>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [invName, setInvName] = useState('')
  const [invEmail, setInvEmail] = useState('')
  const [invPassword, setInvPassword] = useState('')
  const [invCafeIds, setInvCafeIds] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)

  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editName, setEditName] = useState('')
  const [editCafeIds, setEditCafeIds] = useState<string[]>([])
  const [savingMember, setSavingMember] = useState(false)

  const [locationOpen, setLocationOpen] = useState(false)
  const [newCafeName, setNewCafeName] = useState('')
  const [newCafeAddress, setNewCafeAddress] = useState('')
  const [newCafeCity, setNewCafeCity] = useState('Cape Town')
  const [addingCafe, setAddingCafe] = useState(false)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 4000)
  }

  const fetchData = async () => {
    try {
      const [teamRes, cafeRes] = await Promise.all([
        api.get<{ success: boolean; members: TeamMember[]; seats?: SeatSummary }>('/team'),
        api.get<{ success: boolean; cafes: CafeBasic[] }>('/cafe/list'),
      ])
      setMembers(teamRes.data.members || [])
      setSeats(teamRes.data.seats || null)
      setCafes(cafeRes.data.cafes || [])
    } catch {
      showToast('error', 'Failed to load team data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOwner) fetchData()
    else setLoading(false)
  }, [isOwner])

  const sortedMembers = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  const managerCount = members.filter((member) => member.role === 'manager').length
  const seatLimitReached = Boolean(seats && seats.remaining <= 0)
  const seatValue = seats ? `${seats.used}/${seats.included}` : String(members.length)
  const seatSub = seats
    ? seatLimitReached
      ? `${seats.plan} plan is full`
      : `${seats.remaining} available on ${seats.plan}`
    : 'Seat usage'

  const openInviteDialog = () => {
    setInvName('')
    setInvEmail('')
    setInvPassword(generateTempPassword())
    setInvCafeIds(cafes.length === 1 ? [cafes[0]._id] : [])
    setInviteOpen(true)
  }

  const openLocationDialog = () => {
    setNewCafeName('')
    setNewCafeAddress('')
    setNewCafeCity('Cape Town')
    setLocationOpen(true)
  }

  const toggleInviteCafe = (cafeId: string) => {
    setInvCafeIds((prev) =>
      prev.includes(cafeId) ? prev.filter((id) => id !== cafeId) : [...prev, cafeId]
    )
  }

  const toggleEditCafe = (cafeId: string) => {
    setEditCafeIds((prev) =>
      prev.includes(cafeId) ? prev.filter((id) => id !== cafeId) : [...prev, cafeId]
    )
  }

  const beginEdit = (member: TeamMember) => {
    setEditingMember(member)
    setEditName(member.name)
    setEditCafeIds(member.cafeIds.map((cafe) => cafe._id))
  }

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    const name = invName.trim()
    const email = invEmail.trim()
    const password = invPassword.trim()

    if (!name || !email || !password || invCafeIds.length === 0) {
      showToast('error', 'Name, email, password, and cafe access are required.')
      return
    }

    setInviting(true)
    try {
      await api.post('/team/invite', {
        name,
        email,
        password,
        cafeIds: invCafeIds,
      })
      showToast('success', `${name} was added to the team.`)
      setInviteOpen(false)
      await fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to add team member.')
    } finally {
      setInviting(false)
    }
  }

  const handleSaveMember = async () => {
    if (!editingMember) return
    const name = editName.trim()

    if (!name || editCafeIds.length === 0) {
      showToast('error', 'Member name and cafe access are required.')
      return
    }

    setSavingMember(true)
    try {
      await api.patch(`/team/${editingMember._id}`, { name, cafeIds: editCafeIds })
      showToast('success', `${name} was updated.`)
      setEditingMember(null)
      await fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to update member.')
    } finally {
      setSavingMember(false)
    }
  }

  const handleRemove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from your organisation?`)) return
    try {
      await api.delete(`/team/${userId}`)
      showToast('success', `${name} has been removed.`)
      await fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to remove member.')
    }
  }

  const handleAddCafe = async (e: FormEvent) => {
    e.preventDefault()
    const name = newCafeName.trim()

    if (!name) {
      showToast('error', 'Cafe name is required.')
      return
    }

    setAddingCafe(true)
    try {
      await api.post('/team/add-cafe', {
        name,
        address: newCafeAddress.trim(),
        city: newCafeCity.trim() || 'Cape Town',
      })
      showToast('success', `${name} was added.`)
      setLocationOpen(false)
      await fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to add cafe.')
    } finally {
      setAddingCafe(false)
    }
  }

  if (!isOwner) {
    return (
      <AppLayout title="Team">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-900/20">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-text">Access Denied</h2>
          <p className="max-w-md text-sm text-muted">
            Only account owners can manage organisation seats. Contact your organisation owner for access changes.
          </p>
        </div>
      </AppLayout>
    )
  }

  if (loading) {
    return (
      <AppLayout title="Team">
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-guava-red/30 border-t-guava-red" />
        </div>
      </AppLayout>
    )
  }

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={openLocationDialog}>
        <Store className="h-3.5 w-3.5" />
        Add location
      </Button>
      <Button variant="success" size="sm" onClick={openInviteDialog} disabled={seatLimitReached}>
        <UserPlus className="h-3.5 w-3.5" />
        Add member
      </Button>
    </div>
  )

  return (
    <AppLayout title="Team" actions={actions}>
      <div className="space-y-6">
        <Toast toast={toast} />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatTile
            label="Seats"
            value={seatValue}
            sub={seatSub}
            icon={Users}
            tone={seatLimitReached ? 'warn' : 'good'}
          />
          <StatTile
            label="Managers"
            value={String(managerCount)}
            sub={managerCount === 1 ? '1 manager account' : `${managerCount} manager accounts`}
            icon={ShieldCheck}
          />
          <StatTile
            label="Locations"
            value={String(cafes.length)}
            sub={cafes.length === 1 ? cafes[0].name : 'Cafe branches'}
            icon={Store}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-guava-red" />
                    Team members
                  </CardTitle>
                  <CardDescription>{members.length} member{members.length === 1 ? '' : 's'}</CardDescription>
                </div>
                {seats && (
                  <Badge variant={seatLimitReached ? 'destructive' : 'secondary'} className="w-fit">
                    {seats.plan} plan
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {sortedMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-[#111111]">
                    <Users className="h-5 w-5 text-muted" />
                  </div>
                  <h3 className="text-sm font-semibold text-text">No team members yet</h3>
                  <Button className="mt-4" size="sm" onClick={openInviteDialog} disabled={seatLimitReached}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Add member
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {sortedMembers.map((member) => (
                    <div
                      key={member._id}
                      className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(240px,1.2fr)_120px_minmax(220px,1fr)_92px] lg:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Initials name={member.name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text">{member.name}</p>
                          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-[#666666]">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Badge variant={member.role === 'owner' ? 'success' : 'warning'}>{member.role}</Badge>
                      </div>

                      <div className="min-w-0">
                        {member.cafeIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {member.cafeIds.map((cafe) => (
                              <Badge key={cafe._id} variant="secondary" className="max-w-42 truncate">
                                {cafe.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-[#666666]">No cafe access</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 lg:justify-end">
                        {member.role === 'manager' ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => beginEdit(member)}
                              aria-label={`Edit ${member.name}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemove(member._id, member.name)}
                              className="text-[#777777] hover:text-red-400"
                              aria-label={`Remove ${member.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-[#666666]">Owner</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-guava-red" />
                    Locations
                  </CardTitle>
                  <CardDescription>{cafes.length} cafe{cafes.length === 1 ? '' : 's'}</CardDescription>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={openLocationDialog} aria-label="Add location">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {cafes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-[#111111] px-4 py-8 text-center">
                  <Building2 className="mx-auto mb-3 h-5 w-5 text-muted" />
                  <p className="text-sm text-[#666666]">No locations yet</p>
                </div>
              ) : (
                cafes.map((cafe) => (
                  <div key={cafe._id} className="flex items-center gap-3 rounded-lg border border-border bg-[#111111] px-3 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <span className="min-w-0 truncate text-sm font-medium text-text">{cafe.name}</span>
                  </div>
                ))
              )}
              {seats && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Seat usage</span>
                      <span className="font-medium text-text">{seats.used}/{seats.included}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full border border-border bg-[#111111]">
                      <div
                        className={cn('h-full rounded-full', seatLimitReached ? 'bg-guava-red' : 'bg-guava-green')}
                        style={{ width: `${Math.min(100, Math.round((seats.used / seats.included) * 100))}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={inviteOpen}
        title="Add team member"
        description="Managers sign in with their own account and see assigned cafe data."
        onClose={() => setInviteOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="invite-member-form" disabled={inviting || seatLimitReached || cafes.length === 0}>
              <UserPlus className="h-4 w-4" />
              {inviting ? 'Adding...' : 'Add member'}
            </Button>
          </>
        }
      >
        <form id="invite-member-form" onSubmit={handleInvite} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inv-name">Name</Label>
              <Input
                id="inv-name"
                placeholder="Team member name"
                value={invName}
                onChange={(e) => setInvName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-email">Email</Label>
              <Input
                id="inv-email"
                type="email"
                placeholder="member@example.com"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-password">Temporary password</Label>
            <div className="flex gap-2">
              <Input
                id="inv-password"
                type="text"
                placeholder="Temporary password"
                value={invPassword}
                onChange={(e) => setInvPassword(e.target.value)}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setInvPassword(generateTempPassword())} aria-label="Generate password">
                <KeyRound className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assigned cafes</Label>
            <CafeAccessPicker cafes={cafes} selectedIds={invCafeIds} onToggle={toggleInviteCafe} />
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editingMember)}
        title="Edit member"
        description={editingMember?.email}
        onClose={() => setEditingMember(null)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveMember} disabled={savingMember}>
              {savingMember ? 'Saving...' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Assigned cafes</Label>
            <CafeAccessPicker cafes={cafes} selectedIds={editCafeIds} onToggle={toggleEditCafe} />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={locationOpen}
        title="Add location"
        description="New locations count toward your plan allowance."
        onClose={() => setLocationOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setLocationOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-location-form" disabled={addingCafe}>
              <Store className="h-4 w-4" />
              {addingCafe ? 'Adding...' : 'Add location'}
            </Button>
          </>
        }
      >
        <form id="add-location-form" onSubmit={handleAddCafe} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cafe-name">Cafe name</Label>
            <Input
              id="cafe-name"
              placeholder="e.g. Blouberg Coffee"
              value={newCafeName}
              onChange={(e) => setNewCafeName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cafe-address">Address</Label>
            <Input
              id="cafe-address"
              placeholder="123 Main Street"
              value={newCafeAddress}
              onChange={(e) => setNewCafeAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cafe-city">City</Label>
            <Input
              id="cafe-city"
              placeholder="Cape Town"
              value={newCafeCity}
              onChange={(e) => setNewCafeCity(e.target.value)}
            />
          </div>
        </form>
      </Dialog>
    </AppLayout>
  )
}
