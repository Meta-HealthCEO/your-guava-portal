import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  KeyRound,
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
import { secureRandomId } from '@/lib/idempotency'
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
type PaymentStatusResponse = {
  success: boolean
  payment: PaymentIntent
}

const formatRand = (value: number) => `R${value.toLocaleString('en-ZA')}`
const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'

const newPaymentIdempotencyKey = (kind: 'plan' | 'credits') => {
  const entropy = secureRandomId()
  return `${kind}:${Date.now().toString(36)}:${entropy}`.slice(0, 160)
}

function StatusBanner({
  state,
  successMessage = 'Account details saved.',
  errorMessage = 'Failed to save account details.',
}: {
  state: SaveState
  successMessage?: string
  errorMessage?: string
}) {
  if (state === 'success') {
    return (
      <div className="flex items-center gap-2 bg-guava-green/10 border border-guava-green/20 rounded-lg px-3.5 py-2.5 text-sm text-guava-green">
        <CheckCircle className="w-4 h-4 shrink-0" />
        <span>{successMessage}</span>
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="flex items-center gap-2 bg-red-900/10 border border-red-900/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{errorMessage}</span>
      </div>
    )
  }
  return null
}

function Notice({ notice }: { notice: NoticeState }) {
  if (!notice) return null
  return (
    <div
      role={notice.type === 'success' ? 'status' : 'alert'}
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
      <p className="text-muted text-[11px] uppercase tracking-wider font-medium">{label}</p>
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
          <p className="text-muted text-xs">{cycle === 'annual' ? 'per year' : 'per month'}</p>
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
  const { user, isOwner, logout } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [account, setAccount] = useState<Account | null>(null)
  const [accountError, setAccountError] = useState(false)
  const [notice, setNotice] = useState<NoticeState>(null)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null)
  const [isBuyingCredits, setIsBuyingCredits] = useState(false)
  const [profileName, setProfileName] = useState(user?.name ?? '')
  const [organizationName, setOrganizationName] = useState('')
  const [billingEmail, setBillingEmail] = useState(user?.email ?? '')
  const [profileState, setProfileState] = useState<SaveState>('idle')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordState, setPasswordState] = useState<SaveState>('idle')
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const planCheckoutRef = useRef<{ intent: string; key: string } | null>(null)
  const creditCheckoutRef = useRef<{ intent: string; key: string } | null>(null)
  const paymentQuery = searchParams.toString()

  const showNotice = useCallback((type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 4000)
  }, [])

  const hydrateAccount = useCallback(
    () => api
      .get<{ success: boolean; account: Account }>('/account')
      .then(({ data }) => {
        setAccountError(false)
        setAccount(data.account)
        setBillingCycle(data.account.organization.billingCycle || 'monthly')
        setProfileName(data.account.user.name)
        setOrganizationName(data.account.organization.name)
        setBillingEmail(data.account.organization.billingEmail || data.account.user.email)
      }),
    []
  )

  useEffect(() => {
    hydrateAccount()
      .catch(() => {
        setAccountError(true)
        setProfileName(user?.name ?? '')
        setBillingEmail(user?.email ?? '')
      })
  }, [hydrateAccount, user?.email, user?.name])

  useEffect(() => {
    const paymentHint = searchParams.get('payment')
    const reference = searchParams.get('reference')
    if (!paymentHint || (section !== 'all' && section !== 'billing')) return

    let cancelled = false
    const verifyPayment = async () => {
      if (!reference) {
        showNotice('error', 'Payment could not be verified because its reference is missing.')
      } else {
        try {
          const { data } = await api.get<PaymentStatusResponse>(`/account/payments/${encodeURIComponent(reference)}`)
          if (cancelled) return
          const status = data.payment.status
          if (status === 'paid') {
            await hydrateAccount()
            if (!cancelled) showNotice('success', 'Card payment confirmed. Billing has been updated.')
          } else if (status === 'pending') {
            showNotice('success', 'Card payment is still pending. Guava will update billing after confirmation.')
          } else if (status === 'cancelled') {
            showNotice('error', 'Card payment was cancelled. No billing changes were made.')
          } else {
            showNotice('error', 'Card payment was not completed. No billing changes were made.')
          }
        } catch {
          if (!cancelled) showNotice('error', 'Payment status could not be verified. Please refresh and check billing again.')
        }
      }

      if (!cancelled) {
        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('payment')
        nextParams.delete('reference')
        setSearchParams(nextParams, { replace: true })
      }
    }

    void verifyPayment()
    return () => {
      cancelled = true
    }
  }, [hydrateAccount, paymentQuery, section, searchParams, setSearchParams, showNotice])

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault()
    setProfileState('saving')
    try {
      const profilePayload = isOwner
        ? { name: profileName, organizationName, billingEmail }
        : { name: profileName }
      const { data } = await api.patch<{ success: boolean; account: Account }>('/account/profile', profilePayload)
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

  const handlePasswordSave = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError(undefined)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Current password, new password, and confirmation are required.')
      setPasswordState('error')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      setPasswordState('error')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      setPasswordState('error')
      return
    }

    setPasswordState('saving')
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordState('success')
      showNotice('success', 'Password changed. Please sign in again.')
      await logout()
    } catch (err: any) {
      setPasswordError(err?.response?.data?.message || 'Failed to change password.')
      setPasswordState('error')
    }
  }

  const displayName = account?.user.name || user?.name || ''
  const displayEmail = account?.user.email || user?.email || ''
  const displayOrgName = account?.organization.name || ''
  const displayBillingEmail = account?.organization.billingEmail || displayEmail

  const handlePlanCheckout = async (plan: BillingPlan) => {
    setCheckoutPlan(plan.id)
    const intent = `${plan.id}:${billingCycle}`
    if (planCheckoutRef.current?.intent !== intent) {
      planCheckoutRef.current = { intent, key: newPaymentIdempotencyKey('plan') }
    }
    const idempotencyKey = planCheckoutRef.current.key
    try {
      const { data } = await api.post<CheckoutResponse>('/account/checkout', {
        plan: plan.id,
        billingCycle,
      }, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })

      if (data.checkout.redirectUrl) {
        showNotice('success', 'Opening secure card checkout...')
        window.location.assign(data.checkout.redirectUrl)
        return
      }

      if (data.account) {
        setAccount(data.account)
        planCheckoutRef.current = null
        showNotice('success', `${plan.name} plan activated.`)
      } else {
        showNotice('error', 'Secure checkout is still being prepared. Try again in a moment.')
      }
    } catch (err: any) {
      if (err?.response && err.response.status < 500 && err.response.status !== 408 && err.response.status !== 429) {
        planCheckoutRef.current = null
      }
      showNotice('error', err?.response?.data?.message || 'Could not start card checkout.')
    } finally {
      setCheckoutPlan(null)
    }
  }

  const handleBuyCredits = async () => {
    setIsBuyingCredits(true)
    const intent = 'credits:500'
    if (creditCheckoutRef.current?.intent !== intent) {
      creditCheckoutRef.current = { intent, key: newPaymentIdempotencyKey('credits') }
    }
    const idempotencyKey = creditCheckoutRef.current.key
    try {
      const { data } = await api.post<CreditPurchaseResponse>(
        '/account/ai-credits',
        { credits: 500 },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )

      if (data.purchase.redirectUrl) {
        showNotice('success', 'Opening secure card checkout...')
        window.location.assign(data.purchase.redirectUrl)
        return
      }

      if (data.account) {
        setAccount(data.account)
        creditCheckoutRef.current = null
        showNotice('success', 'Added 500 Guava Credits to this billing period.')
      } else {
        showNotice('error', 'Secure checkout is still being prepared. Try again in a moment.')
      }
    } catch (err: any) {
      if (err?.response && err.response.status < 500 && err.response.status !== 408 && err.response.status !== 429) {
        creditCheckoutRef.current = null
      }
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
        {accountError && (
          <div className="flex flex-col gap-3 rounded-lg border border-red-900/30 bg-red-900/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-sm text-red-300">Account and billing details could not be loaded.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => hydrateAccount().catch(() => setAccountError(true))}>
              Try again
            </Button>
          </div>
        )}

        {showAccountSection && <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-guava-red" />
                  <CardTitle>Account Details</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  {isOwner
                    ? 'Manage your profile, organisation name, and billing contact.'
                    : 'Manage your profile. Organisation billing is managed by the account owner.'}
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
                {isOwner && (
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
                )}
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

        {showAccountSection && <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-guava-red" />
              <CardTitle>Password</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Change your password and sign in again with the new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSave} className="space-y-4 max-w-3xl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <StatusBanner
                state={passwordState}
                successMessage="Password changed."
                errorMessage={passwordError || 'Failed to change password.'}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={passwordState === 'saving'}>
                  <KeyRound className="w-3.5 h-3.5" />
                  {passwordState === 'saving' ? 'Changing...' : 'Change Password'}
                </Button>
              </div>
            </form>
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
                  {account ? `${account.usage.seats.used}/${account.usage.seats.included}` : '—'}
                </p>
                <p className="text-muted text-xs mt-1">Organisation users</p>
              </div>
              <div className="rounded-lg border border-border bg-[#111111] p-4">
                <p className="text-muted text-sm">Locations</p>
                <p className="text-text text-2xl font-semibold mt-2">
                  {account ? `${account.usage.locations.used}/${account.usage.locations.included}` : '—'}
                </p>
                <p className="text-muted text-xs mt-1">Cafe branches</p>
              </div>
              <div className="rounded-lg border border-border bg-[#111111] p-4">
                <p className="text-muted text-sm">Guava Credits</p>
                <p className="text-text text-2xl font-semibold mt-2">{account ? credits?.available ?? 0 : '—'}</p>
                <p className="text-muted text-xs mt-1">Power AI and data checks</p>
              </div>
            </div>

            <UsageMeter label="Guava Credit usage this period" used={credits?.used ?? 0} total={creditTotal || 1} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={handleBuyCredits} disabled={!isOwner || isBuyingCredits}>
                <Sparkles className="w-3.5 h-3.5" />
                {isBuyingCredits ? 'Opening checkout...' : 'Add 500 Guava Credits'}
              </Button>
              <p className="text-muted text-xs flex items-center">
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
                          <span className="block text-xs text-muted">{formatDate(entry.createdAt)}</span>
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
            {!isOwner && <p className="text-muted text-xs">Only the account owner can change billing.</p>}
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
