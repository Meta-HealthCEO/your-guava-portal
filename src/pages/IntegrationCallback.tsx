import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, AlertCircle } from 'lucide-react'
import api from '@/lib/api'

type Phase = 'exchanging' | 'success' | 'error'

const PROVIDER_DISPLAY: Record<string, string> = {
  xero: 'Xero',
  quickbooks: 'QuickBooks',
  sage: 'Sage Accounting',
}

export default function IntegrationCallback() {
  const { provider = '' } = useParams<{ provider: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('exchanging')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Prevent double-invoke in React Strict Mode
  const called = useRef(false)

  const providerName = PROVIDER_DISPLAY[provider] ?? provider

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      setErrorMsg('No authorisation code was returned by the provider.')
      setPhase('error')
      return
    }

    const body: Record<string, string> = { code }
    if (state) body.state = state
    const realmId = searchParams.get('realmId')
    const tenantId = searchParams.get('tenantId')
    const businessId = searchParams.get('businessId') || searchParams.get('business_id')
    if (realmId) body.realmId = realmId
    if (tenantId) body.tenantId = tenantId
    if (businessId) body.businessId = businessId

    api
      .post(`/integrations/${provider}/callback`, body)
      .then(() => {
        setPhase('success')
        setTimeout(() => navigate('/integrations'), 1500)
      })
      .catch((err: unknown) => {
        let msg = 'Connection failed. Please try again.'
        if (err && typeof err === 'object' && 'response' in err) {
          const r = (err as { response?: { data?: { message?: string } } }).response
          if (r?.data?.message) msg = r.data.message
        } else if (err instanceof Error) {
          msg = err.message
        }
        setErrorMsg(msg)
        setPhase('error')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-[#111111] border border-border p-8 text-center shadow-2xl">
        {phase === 'exchanging' && (
          <>
            <div className="w-12 h-12 border-2 border-guava-red/30 border-t-guava-red rounded-full animate-spin mx-auto mb-4" />
            <p className="text-text font-semibold text-base">
              Connecting to {providerName}…
            </p>
            <p className="text-[#555555] text-sm mt-1">Exchanging authorisation code</p>
          </>
        )}

        {phase === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-guava-green/10 border border-guava-green/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-guava-green" />
            </div>
            <p className="text-text font-semibold text-base">Connected</p>
            <p className="text-[#555555] text-sm mt-1">
              {providerName} connected successfully. Redirecting…
            </p>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-text font-semibold text-base">Connection failed</p>
            {errorMsg && (
              <p className="text-red-400 text-sm mt-2 break-words">{errorMsg}</p>
            )}
            <Link
              to="/integrations"
              className="inline-block mt-5 text-sm text-guava-red hover:underline"
            >
              Back to Integrations
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
