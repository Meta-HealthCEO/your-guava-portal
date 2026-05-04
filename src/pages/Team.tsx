import { useState, useEffect, type FormEvent } from 'react'
import { Users, Plus, Trash2, CheckCircle, AlertCircle, Store } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import type { TeamMember, CafeBasic } from '@/types'

type ToastState = { type: 'success' | 'error'; message: string } | null

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null
  return (
    <div
      className={
        toast.type === 'success'
          ? 'flex items-center gap-2 bg-[#4DA63B]/10 border border-[#4DA63B]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#4DA63B]'
          : 'flex items-center gap-2 bg-red-900/10 border border-red-900/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400'
      }
    >
      {toast.type === 'success' ? (
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      <span>{toast.message}</span>
    </div>
  )
}

export default function Team() {
  const { isOwner } = useAuth()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [cafes, setCafes] = useState<CafeBasic[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastState>(null)

  // Invite form state
  const [invName, setInvName] = useState('')
  const [invEmail, setInvEmail] = useState('')
  const [invPassword, setInvPassword] = useState('')
  const [invCafeIds, setInvCafeIds] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)

  // Add cafe form state
  const [newCafeName, setNewCafeName] = useState('')
  const [newCafeAddress, setNewCafeAddress] = useState('')
  const [newCafeCity, setNewCafeCity] = useState('')
  const [addingCafe, setAddingCafe] = useState(false)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchData = async () => {
    try {
      const [teamRes, cafeRes] = await Promise.all([
        api.get<{ success: boolean; members: TeamMember[] }>('/team'),
        api.get<{ success: boolean; cafes: CafeBasic[] }>('/cafe/list'),
      ])
      setMembers(teamRes.data.members || [])
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

  // Guard: non-owners see 403
  if (!isOwner) {
    return (
      <AppLayout title="Team">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-[#F0F0F0] mb-2">Access Denied</h2>
          <p className="text-[#888888] text-sm max-w-md">
            Only account owners can manage team members. Contact your organization owner for access changes.
          </p>
        </div>
      </AppLayout>
    )
  }

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!invName || !invEmail || !invPassword || invCafeIds.length === 0) {
      showToast('error', 'Please fill all fields and select at least one cafe.')
      return
    }
    setInviting(true)
    try {
      await api.post('/team/invite', {
        name: invName,
        email: invEmail,
        password: invPassword,
        cafeIds: invCafeIds,
      })
      showToast('success', `Invited ${invName} successfully.`)
      setInvName('')
      setInvEmail('')
      setInvPassword('')
      setInvCafeIds([])
      fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to invite manager.')
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from your team?`)) return
    try {
      await api.delete(`/team/${userId}`)
      showToast('success', `${name} has been removed.`)
      fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to remove member.')
    }
  }

  const handleAddCafe = async (e: FormEvent) => {
    e.preventDefault()
    if (!newCafeName) {
      showToast('error', 'Cafe name is required.')
      return
    }
    setAddingCafe(true)
    try {
      await api.post('/team/add-cafe', {
        name: newCafeName,
        address: newCafeAddress,
        city: newCafeCity || 'Cape Town',
      })
      showToast('success', `${newCafeName} added successfully.`)
      setNewCafeName('')
      setNewCafeAddress('')
      setNewCafeCity('')
      fetchData()
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to add cafe.')
    } finally {
      setAddingCafe(false)
    }
  }

  const toggleCafeSelection = (cafeId: string) => {
    setInvCafeIds((prev) =>
      prev.includes(cafeId) ? prev.filter((id) => id !== cafeId) : [...prev, cafeId]
    )
  }

  if (loading) {
    return (
      <AppLayout title="Team Management">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-[#D43D3D]/30 border-t-[#D43D3D] rounded-full animate-spin" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Team Management">
      <div className="space-y-6">
        {/* Subtitle */}
        <p className="text-[#888888] text-sm -mt-2">
          Manage your team and cafe locations.
        </p>

        {/* Toast */}
        <Toast toast={toast} />

        {/* Top section: Invite + Members side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — Invite Manager */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Invite Manager
              </CardTitle>
              <CardDescription>Add a new manager to your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inv-name">Name</Label>
                  <Input
                    id="inv-name"
                    placeholder="Manager name"
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-email">Email</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    placeholder="manager@example.com"
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-password">Password</Label>
                  <Input
                    id="inv-password"
                    type="password"
                    placeholder="Temporary password"
                    value={invPassword}
                    onChange={(e) => setInvPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assign to Cafes</Label>
                  <div className="space-y-2">
                    {cafes.map((cafe) => (
                      <label
                        key={cafe._id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#111111] border border-[#2A2A2A] cursor-pointer hover:border-[#3A3A3A] transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={invCafeIds.includes(cafe._id)}
                          onChange={() => toggleCafeSelection(cafe._id)}
                          className="w-4 h-4 rounded border-[#333333] bg-[#111111] text-[#D43D3D] focus:ring-[#D43D3D] focus:ring-offset-0"
                        />
                        <span className="text-sm text-[#F0F0F0]">{cafe.name}</span>
                      </label>
                    ))}
                    {cafes.length === 0 && (
                      <p className="text-[#555555] text-sm">No cafes found.</p>
                    )}
                  </div>
                </div>
                <Button type="submit" variant="success" className="w-full" disabled={inviting}>
                  {inviting ? 'Inviting...' : 'Invite Manager'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Right — Team Members List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Team Members
              </CardTitle>
              <CardDescription>{members.length} member{members.length !== 1 ? 's' : ''} in your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member._id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-[#111111] border border-[#2A2A2A]"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#2A2A2A] flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-[#F0F0F0]">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[#F0F0F0] truncate">{member.name}</span>
                        <Badge variant={member.role === 'owner' ? 'success' : 'warning'}>
                          {member.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#555555] truncate mt-0.5">{member.email}</p>
                      {member.cafeIds && member.cafeIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {member.cafeIds.map((cafe) => (
                            <Badge key={cafe._id} variant="secondary" className="text-[10px]">
                              {cafe.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Remove button — only for managers */}
                    {member.role === 'manager' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(member._id, member.name)}
                        className="shrink-0 text-[#555555] hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="text-[#555555] text-sm text-center py-6">No team members yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom — Add Cafe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              Add Cafe
            </CardTitle>
            <CardDescription>Add a new cafe location to your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddCafe} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="cafe-name">Cafe Name</Label>
                <Input
                  id="cafe-name"
                  placeholder="e.g. Blouberg Coffee"
                  value={newCafeName}
                  onChange={(e) => setNewCafeName(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="cafe-address">Address</Label>
                <Input
                  id="cafe-address"
                  placeholder="123 Main Street"
                  value={newCafeAddress}
                  onChange={(e) => setNewCafeAddress(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="cafe-city">City</Label>
                <Input
                  id="cafe-city"
                  placeholder="Cape Town"
                  value={newCafeCity}
                  onChange={(e) => setNewCafeCity(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="success" disabled={addingCafe}>
                  {addingCafe ? 'Adding...' : 'Add Cafe'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
