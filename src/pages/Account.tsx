import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Sparkles,
  User as UserIcon,
  WalletCards,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import type { Account, BillingPlan } from '@/types'

type SaveState = 'idle' | 'saving' | 'success' | 'error'
type NoticeState = { type: 'success' | 'error'; message: string } | null
type BillingCycle = 'monthly' | 'annual'

const formatRand = (value: number) => `R${value.toLocaleString('en-ZA')}`

function StatusBanner({ state }: { state: SaveState }) {
  if (state === 'success') {
    return (
      <div className="flex items-center gap-2 bg-guava-green/10 border border-guava-green/20 rounded-lg px-3.5 py-2.5 text-sm text-guava-green">
        <CheckCircle className="w-4 h-4 shrink-0" />
        <span>Account details saved.</span>
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="flex items-center gap-2 bg-red-900/10 border border-red-900/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Failed to save account details.</span>
      </div>
    )
  }
  return null
}

function Notice({ notice }: { notice: NoticeState }) {
  if (!notice) return null
  return (
    <div
      className={
        notice.type === 'success'
          ? 'flex items-center gap-2 bg-guava-green/10 border border-guava-green/20 rounded-lg px-3.5 py-2.5 text-sm text-guava-green'
          : 'flex items-center gap-2 bg-red-900/10 border border-red-900/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400'
      }
    >
      {notice.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      <span>{notice.message}</span>
    </div>
  )
}

function UsageMeter({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="text-text font-medium">
          {used} / {total}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#111111] border border-border overflow-hidden">
        <div className="h-full bg-guava-red" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  active,
  cycle,
  onSelect,
  disabled,
}: {
  plan: BillingPlan
  active: boolean
  cycle: BillingCycle
  onSelect: () => void
  disabled: boolean
}) {
  const price = cycle === 'annual' ? plan.priceAnnual : plan.priceMonthly
  return (
    <div
      className={
        active
          ? 'rounded-lg border border-guava-red bg-guava-red/10 p-4 space-y-4'
          : 'rounded-lg border border-border bg-[#111111] p-4 space-y-4'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-text font-semibold">{plan.name}</h4>
            {active && <Badge variant="success">Current</Badge>}
          </div>
          <p className="text-muted text-sm mt-1">
            {plan.includedSeats} seats, {plan.includedLocations} locations, {plan.includedAiCredits} AI credits
          </p>
        </div>
        <div className="text-right">
          <p className="text-text font-semibold">{formatRand(price)}</p>
          <p className="text-[#555555] text-xs">{cycle === 'annual' ? 'per year' : 'per month'}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {plan.features.slice(0, 4).map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-xs text-muted">
            <CheckCircle className="w-3.5 h-3.5 text-guava-green" />
            <span>{feature}</span>
          </div>
        ))}
      </div>
      <Button type="button" variant={active ? 'secondary' : 'default'} className="w-full" onClick={onSelect} disabled={disabled || active}>
        {active ? 'Active plan' : `Move to ${plan.name}`}
      </Button>
    </div>
  )
}

export default function AccountPage() {
  const { user, isOwner } = useAuth()

  const [account, setAccount] = useState<Account | null>(null)
  const [notice, setNotice] = useState<NoticeState>(null)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null)
  const [profileName, setProfileName] = useState(user?.name ?? '')
  const [organizationName, setOrganizationName] = useState('')
  const [billingEmail, setBillingEmail] = useState(user?.email ?? '')
  const [profileState, setProfileState] = useState<SaveState>('idle')

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 4000)
  }

  useEffect(() => {
    api
      .get<{ success: boolean; account: Account }>('/account')
      .then(({ data }) => {
        setAccount(data.account)
        setBillingCycle(data.account.organization.billingCycle || 'monthly')
        setProfileName(data.account.user.name)
        setOrganizationName(data.account.organization.name)
        setBillingEmail(data.account.organization.billingEmail || data.account.user.email)
      })
      .catch(() => {
        setProfileName(user?.name ?? '')
        setBillingEmail(user?.email ?? '')
      })
  }, [user?.email, user?.name])

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault()
    setProfileState('saving')
    try {
      const { data } = await api.patch<{ success: boolean; account: Account }>('/account/profile', {
        name: profileName,
        organizationName,
        billingEmail,
      })
      setAccount(data.account)
      setProfileState('success')
      setTimeout(() => setProfileState('idle'), 3000)
    } catch {
      setProfileState('error')
    }
  }

  const handlePlanCheckout = async (plan: BillingPlan) => {
    setCheckoutPlan(plan.id)
    try {
      const { data } = await api.post<{ success: boolean; account: Account }>('/account/checkout', {
        plan: plan.id,
        billingCycle,
        paymentMethod: { brand: 'visa', last4: '4242', expiresAt: '12/30' },
      })
      setAccount(data.account)
      showNotice('success', `${plan.name} plan activated with mock payment ending 4242.`)
    } catch (err: any) {
      showNotice('error', err?.response?.data?.message || 'Could not update plan.')
    } finally {
      setCheckoutPlan(null)
    }
  }

  const handleBuyCredits = async () => {
    try {
      const { data } = await api.post<{ success: boolean; account: Account }>('/account/ai-credits', { credits: 250 })
      setAccount(data.account)
      showNotice('success', 'Added 250 AI credits to this billing period.')
    } catch (err: any) {
      showNotice('error', err?.response?.data?.message || 'Could not add AI credits.')
    }
  }

  const selectedPlan = account?.organization.plan || 'starter'
  const ai = account?.usage.aiCredits
  const aiTotal = ai ? ai.included + ai.bonus : 0

  return (
    <AppLayout title="Account">
      <div className="space-y-6">
        <Notice notice={notice} />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-guava-red" />
              <CardTitle>Account Details</CardTitle>
            </div>
            <CardDescription>Manage your profile, organisation name, and billing contact.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSave} className="space-y-4 max-w-3xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name">Full Name</Label>
                  <Input id="profile-name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-email">Email Address</Label>
                  <Input id="profile-email" value={user?.email ?? ''} readOnly className="opacity-60 cursor-default" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="organization-name">Organisation Name</Label>
                  <Input id="organization-name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="billing-email">Billing Email</Label>
                  <Input id="billing-email" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} />
                </div>
              </div>
              <StatusBanner state={profileState} />
              <Button type="submit" disabled={profileState === 'saving'}>
                <UserIcon className="w-3.5 h-3.5" />
                {profileState === 'saving' ? 'Saving...' : 'Save Account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <WalletCards className="w-4 h-4 text-guava-red" />
                  <CardTitle>Billing and Usage</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Plans are priced around organisation seats, cafe locations, and AI credits.
                </CardDescription>
              </div>
              {account && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">{account.organization.billingStatus || 'trialing'}</Badge>
                  <Badge variant="secondary">{account.organization.plan} plan</Badge>
                  {account.organization.paymentMethod && (
                    <Badge variant="outline">
                      {account.organization.paymentMethod.brand} ending {account.organization.paymentMethod.last4}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-[#111111] p-4">
                <p className="text-muted text-sm">Seats</p>
                <p className="text-text text-2xl font-semibold mt-2">
                  {account?.usage.seats.used ?? 1}/{account?.usage.seats.included ?? 2}
                </p>
                <p className="text-[#555555] text-xs mt-1">Organisation users</p>
              </div>
              <div className="rounded-lg border border-border bg-[#111111] p-4">
                <p className="text-muted text-sm">Locations</p>
                <p className="text-text text-2xl font-semibold mt-2">
                  {account?.usage.locations.used ?? 1}/{account?.usage.locations.included ?? 2}
                </p>
                <p className="text-[#555555] text-xs mt-1">Cafe branches</p>
              </div>
              <div className="rounded-lg border border-border bg-[#111111] p-4">
                <p className="text-muted text-sm">AI Credits</p>
                <p className="text-text text-2xl font-semibold mt-2">{ai?.available ?? 0}</p>
                <p className="text-[#555555] text-xs mt-1">1 chat prompt = 1 credit</p>
              </div>
            </div>

            <UsageMeter label="AI credit usage this period" used={ai?.used ?? 0} total={aiTotal || 1} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={handleBuyCredits} disabled={!isOwner}>
                <Sparkles className="w-3.5 h-3.5" />
                Add 250 mock credits
              </Button>
              <p className="text-[#555555] text-xs flex items-center">
                Credits reset monthly. Bonus credits stay until used.
              </p>
            </div>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-text font-semibold">Plans and mock checkout</h3>
                <p className="text-muted text-sm">Use the mock gateway locally; no real card is charged.</p>
              </div>
              <div className="inline-flex rounded-lg border border-border bg-[#111111] p-1 w-fit">
                {(['monthly', 'annual'] as const).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={
                      billingCycle === cycle
                        ? 'px-3 py-1.5 rounded-md bg-guava-red text-white text-xs font-medium'
                        : 'px-3 py-1.5 rounded-md text-muted text-xs font-medium hover:text-text'
                    }
                  >
                    {cycle === 'annual' ? 'Annual' : 'Monthly'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {(account?.plans || []).map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  active={selectedPlan === plan.id}
                  cycle={billingCycle}
                  onSelect={() => handlePlanCheckout(plan)}
                  disabled={!isOwner || checkoutPlan === plan.id}
                />
              ))}
            </div>
            {!isOwner && <p className="text-[#555555] text-xs">Only the account owner can change billing.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-guava-green" />
              <CardTitle>Payment Gateway</CardTitle>
            </div>
            <CardDescription>
              Mock billing is enabled for local development. The API stores plan, seat, credit, and card metadata without charging a real card.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AppLayout>
  )
}
