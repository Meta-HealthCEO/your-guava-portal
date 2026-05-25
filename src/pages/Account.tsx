import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Pencil,
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
type PaymentIntent = {
  provider: 'mock' | 'onegate'
  reference?: string
  redirectUrl?: string
  amount?: number
  currency?: string
  status?: 'pending' | 'paid' | 'failed' | 'cancelled'
}
type CheckoutResponse = { success: boolean; account?: Account; checkout: PaymentIntent }
type CreditPurchaseResponse = {
  success: boolean
  account?: Account
  purchase: PaymentIntent & { credits: number }
}

const formatRand = (value: number) => `R${value.toLocaleString('en-ZA')}`
const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'

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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[#555555] text-[11px] uppercase tracking-wider font-medium">{label}</p>
      <p className="text-text text-sm font-medium">{value || '—'}</p>
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
  const includedCredits = plan.includedGuavaCredits ?? plan.includedAiCredits
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
            {plan.includedSeats} seats, {plan.includedLocations} locations, {includedCredits} Guava Credits
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

export type AccountSettingsSection = 'all' | 'account' | 'billing'

export function AccountSettingsContent({ section = 'all' }: { section?: AccountSettingsSection }) {
  const { user, isOwner } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [account, setAccount] = useState<Account | null>(null)
  const [notice, setNotice] = useState<NoticeState>(null)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null)
  const [isBuyingCredits, setIsBuyingCredits] = useState(false)
  const [profileName, setProfileName] = useState(user?.name ?? '')
  const [organizationName, setOrganizationName] = useState('')
  const [billingEmail, setBillingEmail] = useState(user?.email ?? '')
  const [profileState, setProfileState] = useState<SaveState>('idle')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const paymentQuery = searchParams.toString()

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 4000)
  }

  const hydrateAccount = () =>
    api
      .get<{ success: boolean; account: Account }>('/account')
      .then(({ data }) => {
        setAccount(data.account)
        setBillingCycle(data.account.organization.billingCycle || 'monthly')
        setProfileName(data.account.user.name)
        setOrganizationName(data.account.organization.name)
        setBillingEmail(data.account.organization.billingEmail || data.account.user.email)
      })

  useEffect(() => {
    hydrateAccount()
      .catch(() => {
        setProfileName(user?.name ?? '')
        setBillingEmail(user?.email ?? '')
      })
  }, [user?.email, user?.name])

  useEffect(() => {
    const payment = searchParams.get('payment')
    if (!payment || (section !== 'all' && section !== 'billing')) return

    hydrateAccount().catch(() => undefined)

    if (payment === 'paid') {
      showNotice('success', 'Card payment confirmed. Billing has been updated.')
    } else if (payment === 'pending') {
      showNotice('success', 'Card payment is still pending. Guava will update billing once OneGate confirms it.')
    } else if (payment === 'cancelled') {
      showNotice('error', 'Card payment was cancelled. No billing changes were made.')
    } else {
      showNotice('error', 'Card payment could not be completed. No billing changes were made.')
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('payment')
    nextParams.delete('reference')
    setSearchParams(nextParams, { replace: true })
  }, [paymentQuery, section, setSearchParams])

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
      setIsEditingProfile(false)
      setTimeout(() => setProfileState('idle'), 3000)
    } catch {
      setProfileState('error')
    }
  }

  const handleProfileCancel = () => {
    if (account) {
      setProfileName(account.user.name)
      setOrganizationName(account.organization.name)
      setBillingEmail(account.organization.billingEmail || account.user.email)
    } else {
      setProfileName(user?.name ?? '')
      setOrganizationName('')
      setBillingEmail(user?.email ?? '')
    }
    setProfileState('idle')
    setIsEditingProfile(false)
  }

  const displayName = account?.user.name || user?.name || ''
  const displayEmail = account?.user.email || user?.email || ''
  const displayOrgName = account?.organization.name || ''
  const displayBillingEmail = account?.organization.billingEmail || displayEmail

  const handlePlanCheckout = async (plan: BillingPlan) => {
    setCheckoutPlan(plan.id)
    try {
      const { data } = await api.post<CheckoutResponse>('/account/checkout', {
        plan: plan.id,
        billingCycle,
      })

      if (data.checkout.redirectUrl) {
        showNotice('success', 'Opening secure card checkout...')
        window.location.assign(data.checkout.redirectUrl)
        return
      }

      if (data.account) setAccount(data.account)
      showNotice('success', `${plan.name} plan activated.`)
    } catch (err: any) {
      showNotice('error', err?.response?.data?.message || 'Could not start card checkout.')
    } finally {
      setCheckoutPlan(null)
    }
  }

  const handleBuyCredits = async () => {
    setIsBuyingCredits(true)
    try {
      const { data } = await api.post<CreditPurchaseResponse>('/account/ai-credits', { credits: 500 })

      if (data.purchase.redirectUrl) {
        showNotice('success', 'Opening secure card checkout...')
        window.location.assign(data.purchase.redirectUrl)
        return
      }

      if (data.account) setAccount(data.account)
      showNotice('success', 'Added 500 Guava Credits to this billing period.')
    } catch (err: any) {
      showNotice('error', err?.response?.data?.message || 'Could not start card checkout.')
    } finally {
      setIsBuyingCredits(false)
    }
  }

  const selectedPlan = account?.organization.plan || 'starter'
  const credits = account?.usage.guavaCredits ?? account?.usage.aiCredits
  const creditTotal = credits ? credits.included + credits.bonus : 0
  const creditLedger = account?.usage.creditLedger
  const showAccountSection = section === 'all' || section === 'account'
  const showBillingSection = section === 'all' || section === 'billing'

  return (
      <div className="space-y-6">
        <Notice notice={notice} />

        {showAccountSection && <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-guava-red" />
                  <CardTitle>Account Details</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Manage your profile, organisation name, and billing contact.
                </CardDescription>
              </div>
              {!isEditingProfile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingProfile(true)}
                  disabled={!account}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingProfile ? (
              <form onSubmit={handleProfileSave} className="space-y-4 max-w-3xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name">Full Name</Label>
                    <Input id="profile-name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-email">Email Address</Label>
                    <Input id="profile-email" value={displayEmail} readOnly className="opacity-60 cursor-default" />
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={profileState === 'saving'}>
                    <CheckCircle className="w-3.5 h-3.5" />
                    {profileState === 'saving' ? 'Saving...' : 'Save Account'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleProfileCancel}
                    disabled={profileState === 'saving'}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-5 max-w-3xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                  <ReadOnlyField label="Full Name" value={displayName} />
                  <ReadOnlyField label="Email Address" value={displayEmail} />
                  <ReadOnlyField label="Organisation Name" value={displayOrgName} />
                  <ReadOnlyField label="Billing Email" value={displayBillingEmail} />
                </div>
                <StatusBanner state={profileState} />
              </div>
            )}
          </CardContent>
        </Card>}

        {showBillingSection && <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <WalletCards className="w-4 h-4 text-guava-red" />
                  <CardTitle>Billing and Usage</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Plans are priced around organisation seats, cafe locations, and Guava Credits.
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
                <p className="text-muted text-sm">Guava Credits</p>
                <p className="text-text text-2xl font-semibold mt-2">{credits?.available ?? 0}</p>
                <p className="text-[#555555] text-xs mt-1">Power AI and data checks</p>
              </div>
            </div>

            <UsageMeter label="Guava Credit usage this period" used={credits?.used ?? 0} total={creditTotal || 1} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={handleBuyCredits} disabled={!isOwner || isBuyingCredits}>
                <Sparkles className="w-3.5 h-3.5" />
                {isBuyingCredits ? 'Opening checkout...' : 'Add 500 Guava Credits'}
              </Button>
              <p className="text-[#555555] text-xs flex items-center">
                Included credits reset on {formatDate(credits?.resetAt)}. Bonus credits stay until used.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-[#111111] p-4">
                <h3 className="text-sm font-semibold text-text">Credit usage by feature</h3>
                <div className="mt-3 space-y-2">
                  {(creditLedger?.byFeature || []).length === 0 ? (
                    <p className="text-sm text-muted">No metered usage yet this period.</p>
                  ) : (
                    creditLedger?.byFeature.map((row) => (
                      <div key={row.featureKey} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-muted">{row.label}</span>
                        <span className="font-semibold text-text">{row.credits}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-[#111111] p-4">
                <h3 className="text-sm font-semibold text-text">Recent credit activity</h3>
                <div className="mt-3 space-y-2">
                  {(creditLedger?.recent || []).length === 0 ? (
                    <p className="text-sm text-muted">Credit activity will appear here as AI tools run.</p>
                  ) : (
                    creditLedger?.recent.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate text-muted">{entry.label}</span>
                          <span className="block text-xs text-[#555555]">{formatDate(entry.createdAt)}</span>
                        </span>
                        <span className="font-semibold text-text">{entry.credits}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-text font-semibold">Plans and card checkout</h3>
                <p className="text-muted text-sm">Pay securely by card through hosted checkout.</p>
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
        </Card>}

        {showBillingSection && <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-guava-green" />
              <CardTitle>Payment Gateway</CardTitle>
            </div>
            <CardDescription>
              Card details are captured by OneGate's hosted checkout. Guava stores only the billing status, payment reference, and masked card metadata after confirmation.
            </CardDescription>
          </CardHeader>
        </Card>}
      </div>
  )
}

export default function AccountPage() {
  return (
    <AppLayout title="Account">
      <AccountSettingsContent />
    </AppLayout>
  )
}
