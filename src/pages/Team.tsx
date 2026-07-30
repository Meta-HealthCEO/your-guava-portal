import { useEffect, useState, type ComponentType, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Clock3,
  Crown,
  Edit3,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
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
type SeatSummary = { plan: string; used: number; active?: number; pending?: number; included: number; remaining: number }
type PendingInvitation = {
  _id: string
  name: string
  email: string
  cafeIds: CafeBasic[]
  expiresAt: string
  createdAt: string
  status: 'pending' | 'expired'
  permissions?: { canSpendCredits: boolean }
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
  const { isOwner, logout } = useAuth()
  const navigate = useNavigate()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [cafes, setCafes] = useState<CafeBasic[]>([])
  const [seats, setSeats] = useState<SeatSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastState>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [invName, setInvName] = useState('')
  const [invEmail, setInvEmail] = useState('')
  const [invCafeIds, setInvCafeIds] = useState<string[]>([])
  const [invCanSpendCredits, setInvCanSpendCredits] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [invitationActionId, setInvitationActionId] = useState<string | null>(null)

  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editName, setEditName] = useState('')
  const [editCafeIds, setEditCafeIds] = useState<string[]>([])
  const [editCanSpendCredits, setEditCanSpendCredits] = useState(false)
  const [savingMember, setSavingMember] = useState(false)
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<TeamMember | null>(null)
  const [removingMember, setRemovingMember] = useState(false)
  const [invitationPendingRevoke, setInvitationPendingRevoke] =
    useState<PendingInvitation | null>(null)
  const [ownershipTarget, setOwnershipTarget] = useState<TeamMember | null>(null)
  const [ownershipPassword, setOwnershipPassword] = useState('')
  const [transferringOwnership, setTransferringOwnership] = useState(false)

  const [locationOpen, setLocationOpen] = useState(false)
  const [newCafeName, setNewCafeName] = useState('')
  const [newCafeAddress, setNewCafeAddress] = useState('')
  const [newCafeCity, setNewCafeCity] = useState('')
  const [addingCafe, setAddingCafe] = useState(false)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 4000)
  }

  const fetchData = async () => {
    try {
      const [teamRes, cafeRes] = await Promise.all([
        api.get<{ success: boolean; members: TeamMember[]; invitations?: PendingInvitation[]; seats?: SeatSummary }>('/team'),
        api.get<{ success: boolean; cafes: CafeBasic[] }>('/cafe/list'),
      ])
      setMembers(teamRes.data.members || [])
      setInvitations(teamRes.data.invitations || [])
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
    setInvCafeIds(cafes.length === 1 ? [cafes[0]._id] : [])
    setInvCanSpendCredits(false)
    setInviteOpen(true)
  }

  const openLocationDialog = () => {
    setNewCafeName('')
    setNewCafeAddress('')
    setNewCafeCity('')
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
    setEditCanSpendCredits(Boolean(member.permissions?.canSpendCredits))
  }

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    const name = invName.trim()
    const email = invEmail.trim()

    if (!name || !email || invCafeIds.length === 0) {
      showToast('error', 'Name, email, and cafe access are required.')
      return
    }

    setInviting(true)
    try {
      await api.post<{ emailSent?: boolean }>('/team/invite', {
        name,
        email,
        cafeIds: invCafeIds,
        canSpendCredits: invCanSpendCredits,
      })
      showToast('success', `Invitation sent to ${email}. Their account is created after they accept it.`)
      setInviteOpen(false)
      await fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to add team member.')
    } finally {
      setInviting(false)
    }
  }

  const handleResendInvitation = async (invitation: PendingInvitation) => {
    setInvitationActionId(invitation._id)
    try {
      await api.post(`/team/invitations/${invitation._id}/resend`)
      showToast('success', `A new invitation link was sent to ${invitation.email}.`)
      await fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to resend invitation.')
    } finally {
      setInvitationActionId(null)
    }
  }

  const handleRevokeInvitation = async () => {
    const invitation = invitationPendingRevoke
    if (!invitation) return
    setInvitationActionId(invitation._id)
    try {
      await api.delete(`/team/invitations/${invitation._id}`)
      showToast('success', `Invitation for ${invitation.email} was revoked.`)
      setInvitationPendingRevoke(null)
      await fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to revoke invitation.')
    } finally {
      setInvitationActionId(null)
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
      await api.patch(`/team/${editingMember._id}`, {
        name,
        cafeIds: editCafeIds,
        canSpendCredits: editCanSpendCredits,
      })
      showToast('success', `${name} was updated.`)
      setEditingMember(null)
      await fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to update member.')
    } finally {
      setSavingMember(false)
    }
  }

  const handleRemove = async () => {
    if (!memberPendingRemoval) return

    const removedName = memberPendingRemoval.name
    setRemovingMember(true)
    try {
      await api.delete(`/team/${memberPendingRemoval._id}`)
      showToast('success', `${removedName} has been removed.`)
      setMemberPendingRemoval(null)
      await fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to remove member.')
    } finally {
      setRemovingMember(false)
    }
  }

  const handleAddCafe = async (e: FormEvent) => {
    e.preventDefault()
    const name = newCafeName.trim()

    if (name.length < 2 || name.length > 120) {
      showToast('error', 'Cafe name must be between 2 and 120 characters.')
      return
    }

    setAddingCafe(true)
    try {
      await api.post('/team/add-cafe', {
        name,
        address: newCafeAddress.trim(),
        city: newCafeCity.trim(),
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

  const beginOwnershipTransfer = (member: TeamMember) => {
    setOwnershipTarget(member)
    setOwnershipPassword('')
  }

  const handleOwnershipTransfer = async () => {
    if (!ownershipTarget || !ownershipPassword) return
    setTransferringOwnership(true)
    try {
      await api.post('/team/transfer-ownership', {
        userId: ownershipTarget._id,
        currentPassword: ownershipPassword,
      })
      await logout()
      navigate('/login', { replace: true })
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to transfer ownership.')
      setTransferringOwnership(false)
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

  return (
    <AppLayout title="Team">
      <div className="space-y-6">
        <Toast toast={toast} />

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={openLocationDialog}>
            <Store className="h-3.5 w-3.5" />
            Add location
          </Button>
          <Button variant="success" size="sm" onClick={openInviteDialog} disabled={seatLimitReached}>
            <UserPlus className="h-3.5 w-3.5" />
            Add member
          </Button>
        </div>

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
                        {member.role === 'manager' && (
                          <div className="mt-2">
                            <Badge
                              variant={member.permissions?.canSpendCredits ? 'warning' : 'secondary'}
                            >
                              {member.permissions?.canSpendCredits
                                ? 'Can spend Guava Credits'
                                : 'No credit spending'}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 lg:justify-end">
                        {member.role === 'manager' ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => beginOwnershipTransfer(member)}
                              aria-label={`Transfer ownership to ${member.name}`}
                            >
                              <Crown className="h-4 w-4" />
                            </Button>
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
                              onClick={() => setMemberPendingRemoval(member)}
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

        {invitations.length > 0 && (
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-amber-300" />
                Invitations
              </CardTitle>
              <CardDescription>
                Pending invitations reserve seats. Expired invitations can be resent or revoked.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {invitations.map((invitation) => {
                const busy = invitationActionId === invitation._id
                return (
                  <div key={invitation._id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(220px,1fr)_minmax(180px,1fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">{invitation.name}</p>
                      <p className="mt-1 truncate text-xs text-muted">{invitation.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant={invitation.status === 'expired' ? 'destructive' : 'warning'}>
                          {invitation.status}
                        </Badge>
                        {invitation.permissions?.canSpendCredits && (
                          <Badge variant="secondary">Can spend credits</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {invitation.cafeIds.map((cafe) => (
                        <Badge key={cafe._id} variant="secondary">{cafe.name}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 md:justify-end">
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => handleResendInvitation(invitation)}>
                        <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
                        Resend
                      </Button>
                      <Button type="button" variant="ghost" size="sm" disabled={busy} className="text-red-400" onClick={() => setInvitationPendingRevoke(invitation)}>
                        Revoke
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
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
          <p className="text-xs text-[#777777]">
            We email a single-use link. The manager chooses their password before an account is created.
          </p>
          <div className="space-y-2">
            <Label>Assigned cafes</Label>
            <CafeAccessPicker cafes={cafes} selectedIds={invCafeIds} onToggle={toggleInviteCafe} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-[#111111] p-3">
            <input
              type="checkbox"
              checked={invCanSpendCredits}
              onChange={(event) => setInvCanSpendCredits(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#333333] bg-[#111111] text-guava-red"
            />
            <span>
              <span className="block text-sm font-medium text-text">Allow Guava Credit spending</span>
              <span className="mt-1 block text-xs leading-5 text-muted">
                This manager may run AI and other metered tools for assigned cafes.
              </span>
            </span>
          </label>
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
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-[#111111] p-3">
            <input
              type="checkbox"
              checked={editCanSpendCredits}
              onChange={(event) => setEditCanSpendCredits(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#333333] bg-[#111111] text-guava-red"
            />
            <span>
              <span className="block text-sm font-medium text-text">Allow Guava Credit spending</span>
              <span className="mt-1 block text-xs leading-5 text-muted">
                Permission applies immediately to metered AI and data tools.
              </span>
            </span>
          </label>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(memberPendingRemoval)}
        title="Remove team member"
        description={memberPendingRemoval?.email}
        onClose={() => {
          if (!removingMember) setMemberPendingRemoval(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMemberPendingRemoval(null)}
              disabled={removingMember}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleRemove} disabled={removingMember}>
              <Trash2 className="h-4 w-4" />
              {removingMember ? 'Removing...' : 'Remove member'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-muted">
          Remove <span className="font-medium text-text">{memberPendingRemoval?.name}</span> from your organisation?
          They will lose access to assigned cafe data.
        </p>
      </Dialog>

      <Dialog
        open={Boolean(invitationPendingRevoke)}
        title="Revoke invitation"
        description={invitationPendingRevoke?.email}
        onClose={() => {
          if (!invitationActionId) setInvitationPendingRevoke(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setInvitationPendingRevoke(null)}
              disabled={Boolean(invitationActionId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRevokeInvitation}
              disabled={Boolean(invitationActionId)}
            >
              {invitationActionId ? 'Revoking...' : 'Revoke invitation'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-muted">
          This link will stop working immediately. The reserved seat will be released.
        </p>
      </Dialog>

      <Dialog
        open={Boolean(ownershipTarget)}
        title="Transfer account ownership"
        description={ownershipTarget?.email}
        onClose={() => {
          if (!transferringOwnership) setOwnershipTarget(null)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOwnershipTarget(null)}
              disabled={transferringOwnership}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleOwnershipTransfer}
              disabled={transferringOwnership || !ownershipPassword}
            >
              <Crown className="h-4 w-4" />
              {transferringOwnership ? 'Transferring...' : 'Transfer ownership'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted">
            <span className="font-medium text-text">{ownershipTarget?.name}</span> will become
            the sole owner. You will become a manager, and both users will be signed out.
          </p>
          <div className="space-y-2">
            <Label htmlFor="ownership-password">Confirm your current password</Label>
            <Input
              id="ownership-password"
              type="password"
              value={ownershipPassword}
              onChange={(event) => setOwnershipPassword(event.target.value)}
              autoComplete="current-password"
            />
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
