import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CalendarOff,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { LeaveRequest, StaffMember, LeaveCalendarDay } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
}

const LEAVE_TYPE_COLORS: Record<string, string> = {
  annual: '#4DA63B',
  sick: '#4A9ECC',
  family: '#FFD166',
  unpaid: '#888888',
}

const LEAVE_TYPES = ['annual', 'sick', 'family', 'unpaid'] as const

function getStaffName(staffId: LeaveRequest['staffId']): string {
  if (typeof staffId === 'object' && staffId !== null) return staffId.name
  return staffId
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

// ── Submit Leave Form ────────────────────────────────────────────────────────

interface SubmitLeaveFormProps {
  staffList: StaffMember[]
  onSubmit: (data: { staffId: string; type: string; startDate: string; endDate: string; reason: string }) => Promise<void>
  onCancel: () => void
}

function SubmitLeaveForm({ staffList, onSubmit, onCancel }: SubmitLeaveFormProps) {
  const [staffId, setStaffId] = useState('')
  const [type, setType] = useState<string>('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!staffId || !startDate || !endDate) return
    setSubmitting(true)
    try {
      await onSubmit({ staffId, type, startDate, endDate, reason })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Submit Leave Request</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-[#888888]">Staff *</Label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-[#F0F0F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D43D3D]"
            >
              <option value="">Select staff</option>
              {staffList.filter((s) => s.isActive).map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-[#888888]">Leave Type</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-[#F0F0F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D43D3D]"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-[#888888]">Start Date *</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-[#888888]">End Date *</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs text-[#888888]">Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave..." />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <Button type="submit" variant="success" disabled={!staffId || !startDate || !endDate || submitting}>
              <Plus className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Calendar View ────────────────────────────────────────────────────────────

function LeaveCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [calendarDays, setCalendarDays] = useState<LeaveCalendarDay[]>([])
  const [loading, setLoading] = useState(true)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  useEffect(() => {
    setLoading(true)
    const startDate = new Date(year, month, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]
    api
      .get<{ calendar: LeaveCalendarDay[] }>(`/leave/calendar?startDate=${startDate}&endDate=${endDate}`)
      .then(({ data }) => setCalendarDays(data.calendar || []))
      .catch(() => setCalendarDays([]))
      .finally(() => setLoading(false))
  }, [year, month])

  const calendarMap = useMemo(() => {
    const map = new Map<string, LeaveCalendarDay>()
    calendarDays.forEach((d) => map.set(d.date, d))
    return map
  }, [calendarDays])

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 // Mon=0
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  function prevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1))
  }
  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1))
  }

  const monthLabel = currentMonth.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Leave Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-[#F0F0F0] text-xs font-medium min-w-[120px] text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] rounded-lg" />
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-7 mb-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="text-center text-[10px] text-[#555555] py-1">
                  {d}
                </div>
              ))}
            </div>
            {/* Days */}
            <div className="grid grid-cols-7">
              {Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - startOffset + 1
                const isValid = dayNum >= 1 && dayNum <= daysInMonth
                if (!isValid) {
                  return <div key={idx} className="h-16 border border-[#1A1A1A]" />
                }
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                const calDay = calendarMap.get(dateStr)
                const isToday = dateStr === new Date().toISOString().split('T')[0]

                return (
                  <div
                    key={idx}
                    className={cn(
                      'h-16 border border-[#1F1F1F] p-1 overflow-hidden',
                      isToday && 'bg-[#D43D3D]/5 border-[#D43D3D]/20'
                    )}
                  >
                    <p className={cn('text-[10px] mb-0.5', isToday ? 'text-[#D43D3D] font-bold' : 'text-[#888888]')}>
                      {dayNum}
                    </p>
                    {calDay?.staff.map((s, i) => (
                      <div
                        key={i}
                        className="text-[8px] rounded px-0.5 py-px mb-px truncate"
                        style={{
                          backgroundColor: `${LEAVE_TYPE_COLORS[s.type] ?? '#888888'}20`,
                          color: LEAVE_TYPE_COLORS[s.type] ?? '#888888',
                        }}
                      >
                        {s.name}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3">
              {LEAVE_TYPES.map((t) => (
                <div key={t} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: LEAVE_TYPE_COLORS[t] }} />
                  <span className="text-[10px] text-[#888888] capitalize">{t}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Leave() {
  const { isOwner } = useAuth()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const statusParam = filter === 'all' ? '' : `?status=${filter}`
      const [leaveRes, staffRes] = await Promise.all([
        api.get<{ requests: LeaveRequest[] }>(`/leave${statusParam}`).catch(() => null),
        api.get<{ staff: StaffMember[] }>('/staff').catch(() => null),
      ])
      setRequests(leaveRes?.data?.requests ?? [])
      setStaffList(staffRes?.data?.staff ?? [])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSubmit(data: { staffId: string; type: string; startDate: string; endDate: string; reason: string }) {
    await api.post('/leave', data)
    setShowForm(false)
    await loadData()
  }

  async function handleApprove(id: string) {
    await api.put(`/leave/${id}/approve`)
    await loadData()
  }

  async function handleReject(id: string) {
    await api.put(`/leave/${id}/reject`)
    await loadData()
  }

  const FILTER_TABS: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ]

  return (
    <AppLayout
      title="Leave"
      actions={
        !showForm ? (
          <Button size="sm" variant="success" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Request Leave
          </Button>
        ) : undefined
      }
    >
      {/* Submit Leave Form */}
      {showForm && (
        <SubmitLeaveForm staffList={staffList} onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
        {/* Leave Requests */}
        <div>
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-[#2A2A2A] pb-px">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors relative',
                  filter === tab.id
                    ? 'text-[#D43D3D]'
                    : 'text-[#888888] hover:text-[#F0F0F0]'
                )}
              >
                {tab.label}
                {filter === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D43D3D] rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Requests Table */}
          <Card>
            <CardContent className="pt-5">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : requests.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2A2A2A]">
                        <th className="text-left py-2 pr-4 text-[#888888] font-medium">Staff</th>
                        <th className="text-left py-2 px-4 text-[#888888] font-medium">Type</th>
                        <th className="text-left py-2 px-4 text-[#888888] font-medium">Dates</th>
                        <th className="text-right py-2 px-4 text-[#888888] font-medium">Days</th>
                        <th className="text-center py-2 px-4 text-[#888888] font-medium">Status</th>
                        {isOwner && <th className="text-right py-2 pl-4 text-[#888888] font-medium">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((req) => (
                        <tr key={req._id} className="border-b border-[#1F1F1F] last:border-0">
                          <td className="py-2.5 pr-4 text-[#F0F0F0]">{getStaffName(req.staffId)}</td>
                          <td className="py-2.5 px-4">
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                              style={{
                                color: LEAVE_TYPE_COLORS[req.type] ?? '#888888',
                                backgroundColor: `${LEAVE_TYPE_COLORS[req.type] ?? '#888888'}18`,
                              }}
                            >
                              {req.type}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-[#888888] text-xs">
                            {formatDate(req.startDate)} — {formatDate(req.endDate)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[#F0F0F0] tabular-nums">{req.days}</td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant={STATUS_VARIANT[req.status] ?? 'secondary'} className="text-[10px]">
                              {req.status}
                            </Badge>
                          </td>
                          {isOwner && (
                            <td className="py-2.5 pl-4 text-right">
                              {req.status === 'pending' && (
                                <div className="flex items-center gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-[#4DA63B] hover:text-[#4DA63B] hover:bg-[#4DA63B]/10"
                                    onClick={() => handleApprove(req._id)}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-[#D43D3D] hover:text-[#D43D3D] hover:bg-[#D43D3D]/10"
                                    onClick={() => handleReject(req._id)}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CalendarOff className="w-8 h-8 text-[#555555] mb-3" />
                  <p className="text-[#888888] text-sm">No leave requests</p>
                  <p className="text-[#555555] text-xs mt-1">
                    {filter !== 'all' ? 'Try changing the filter' : 'Submit a leave request to get started'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <div>
          <LeaveCalendar />
        </div>
      </div>
    </AppLayout>
  )
}
