import { useState, useEffect, useCallback } from 'react'
import {
  UserPlus,
  Edit3,
  UserX,
  Phone,
  Mail,
  Calendar,
  DollarSign,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import type { StaffMember, LeaveBalanceData } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  barista: '#D43D3D',
  kitchen: '#E58A3C',
  front: '#4A9ECC',
  manager: '#9B59B6',
  other: '#888888',
}

const ROLE_OPTIONS = ['barista', 'kitchen', 'front', 'manager', 'other'] as const

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Add Staff Form ───────────────────────────────────────────────────────────

interface AddStaffFormProps {
  onSubmit: (data: Omit<StaffMember, '_id' | 'isActive'>) => Promise<void>
  onCancel: () => void
}

function AddStaffForm({ onSubmit, onCancel }: AddStaffFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<StaffMember['role']>('barista')
  const [hourlyRate, setHourlyRate] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        email: email || undefined,
        phone: phone || undefined,
        role,
        hourlyRate: Number(hourlyRate) || 0,
        startDate,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Add Staff Member</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-[#888888]">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <Label className="text-xs text-[#888888]">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <Label className="text-xs text-[#888888]">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="082 123 4567" />
          </div>
          <div>
            <Label className="text-xs text-[#888888]">Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffMember['role'])}
              className="flex h-9 w-full rounded-lg border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-[#F0F0F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D43D3D]"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-[#888888]">Hourly Rate (R)</Label>
            <Input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="55"
              min="0"
              step="0.5"
            />
          </div>
          <div>
            <Label className="text-xs text-[#888888]">Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <Button type="submit" variant="success" disabled={!name || submitting}>
              <UserPlus className="w-4 h-4" />
              {submitting ? 'Adding...' : 'Add Staff'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Inline Edit Form ─────────────────────────────────────────────────────────

interface EditStaffFormProps {
  staff: StaffMember
  onSave: (id: string, data: Partial<StaffMember>) => Promise<void>
  onCancel: () => void
}

function EditStaffForm({ staff, onSave, onCancel }: EditStaffFormProps) {
  const [name, setName] = useState(staff.name)
  const [email, setEmail] = useState(staff.email ?? '')
  const [phone, setPhone] = useState(staff.phone ?? '')
  const [role, setRole] = useState<StaffMember['role']>(staff.role)
  const [hourlyRate, setHourlyRate] = useState(String(staff.hourlyRate))
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    setSubmitting(true)
    try {
      await onSave(staff._id, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        role,
        hourlyRate: Number(hourlyRate) || 0,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 pt-3 border-t border-[#2A2A2A]">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[#888888]">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-[#888888]">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-[#888888]">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-[#888888]">Role</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as StaffMember['role'])}
            className="flex h-9 w-full rounded-lg border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-[#F0F0F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D43D3D]"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs text-[#888888]">Hourly Rate (R)</Label>
          <Input
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            min="0"
            step="0.5"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="success" size="sm" onClick={handleSave} disabled={submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

// ── Leave Balance Bar ────────────────────────────────────────────────────────

function LeaveBar({
  label,
  used,
  total,
  color,
}: {
  label: string
  used: number
  total: number
  color: string
}) {
  const remaining = Math.max(0, total - used)
  const pct = total > 0 ? (remaining / total) * 100 : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#888888]">{label}</span>
        <span className="text-[10px] text-[#F0F0F0] tabular-nums">
          {remaining}/{total} days
        </span>
      </div>
      <div className="h-1.5 bg-[#222222] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── Staff Card ───────────────────────────────────────────────────────────────

function StaffCard({
  staff,
  balance,
  onEdit,
  onDeactivate,
}: {
  staff: StaffMember
  balance?: LeaveBalanceData
  onEdit: (id: string, data: Partial<StaffMember>) => Promise<void>
  onDeactivate: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  async function handleDeactivate() {
    setDeactivating(true)
    try {
      await onDeactivate(staff._id)
    } finally {
      setDeactivating(false)
    }
  }

  async function handleSave(id: string, data: Partial<StaffMember>) {
    await onEdit(id, data)
    setEditing(false)
  }

  const roleColor = ROLE_COLORS[staff.role] ?? '#888888'

  return (
    <Card className={cn(!staff.isActive && 'opacity-50')}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[#F0F0F0] text-sm font-semibold">{staff.name}</h3>
              <Badge
                variant="secondary"
                className="text-[10px]"
                style={{ color: roleColor, backgroundColor: `${roleColor}18` }}
              >
                {staff.role}
              </Badge>
              {!staff.isActive && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {staff.isActive && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(!editing)}>
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[#D43D3D] hover:text-[#D43D3D]"
                  onClick={handleDeactivate}
                  disabled={deactivating}
                >
                  <UserX className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
          {staff.phone && (
            <div className="flex items-center gap-1.5 text-[#888888]">
              <Phone className="w-3 h-3" />
              <span>{staff.phone}</span>
            </div>
          )}
          {staff.email && (
            <div className="flex items-center gap-1.5 text-[#888888]">
              <Mail className="w-3 h-3" />
              <span className="truncate">{staff.email}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[#888888]">
            <DollarSign className="w-3 h-3" />
            <span>R{staff.hourlyRate}/hr</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#888888]">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(staff.startDate)}</span>
          </div>
        </div>

        {/* Leave Balances */}
        {balance && (
          <>
            <Separator className="mb-3" />
            <div className="space-y-2">
              <p className="text-[10px] text-[#555555] uppercase tracking-wider font-medium">Leave Balances</p>
              <LeaveBar label="Annual" used={balance.annual.used} total={balance.annual.total} color="#4DA63B" />
              <LeaveBar label="Sick" used={balance.sick.used} total={balance.sick.total} color="#4A9ECC" />
              <LeaveBar label="Family" used={balance.family.used} total={balance.family.total} color="#FFD166" />
            </div>
          </>
        )}

        {/* Edit Form */}
        {editing && (
          <EditStaffForm staff={staff} onSave={handleSave} onCancel={() => setEditing(false)} />
        )}
      </CardContent>
    </Card>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Staff() {
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [balances, setBalances] = useState<LeaveBalanceData[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [staffRes, balancesRes] = await Promise.all([
        api.get<{ staff: StaffMember[] }>('/api/staff').catch(() => null),
        api.get<{ balances: LeaveBalanceData[] }>('/api/leave/balances').catch(() => null),
      ])
      setStaffList(staffRes?.data?.staff ?? [])
      setBalances(balancesRes?.data?.balances ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const balanceMap = new Map<string, LeaveBalanceData>()
  balances.forEach((b) => balanceMap.set(b.staffId, b))

  async function handleAdd(data: Omit<StaffMember, '_id' | 'isActive'>) {
    await api.post('/api/staff', data)
    setShowAddForm(false)
    await loadData()
  }

  async function handleEdit(id: string, data: Partial<StaffMember>) {
    await api.put(`/api/staff/${id}`, data)
    await loadData()
  }

  async function handleDeactivate(id: string) {
    await api.put(`/api/staff/${id}`, { isActive: false })
    await loadData()
  }

  return (
    <AppLayout
      title="Staff"
      actions={
        !showAddForm ? (
          <Button size="sm" variant="success" onClick={() => setShowAddForm(true)}>
            <UserPlus className="w-4 h-4" />
            Add Staff
          </Button>
        ) : undefined
      }
    >
      {/* Add Staff Form */}
      {showAddForm && <AddStaffForm onSubmit={handleAdd} onCancel={() => setShowAddForm(false)} />}

      {/* Staff Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-5">
                <Skeleton className="h-4 w-32 mb-3" />
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-3 w-28 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : staffList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {staffList.map((staff) => (
            <StaffCard
              key={staff._id}
              staff={staff}
              balance={balanceMap.get(staff._id)}
              onEdit={handleEdit}
              onDeactivate={handleDeactivate}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <div className="w-14 h-14 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center mb-4">
            <UserPlus className="w-7 h-7 text-[#555555]" />
          </div>
          <h2 className="text-[#F0F0F0] text-lg font-semibold mb-2">No staff yet</h2>
          <p className="text-[#555555] text-sm mb-6 max-w-xs">Add your first staff member to get started with scheduling.</p>
          <Button variant="success" onClick={() => setShowAddForm(true)}>
            <UserPlus className="w-4 h-4" />
            Add Staff
          </Button>
        </div>
      )}
    </AppLayout>
  )
}
