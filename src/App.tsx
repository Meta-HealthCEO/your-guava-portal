import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { WORKFORCE_ENABLED } from '@/lib/features'

const Login = lazy(() => import('@/pages/auth/Login'))
const Signup = lazy(() => import('@/pages/auth/Signup'))
const AcceptInvite = lazy(() => import('@/pages/auth/AcceptInvite'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Connect = lazy(() => import('@/pages/Connect'))
const Insights = lazy(() => import('@/pages/Insights'))
const Settings = lazy(() => import('@/pages/Settings'))
const Forecasts = lazy(() => import('@/pages/Forecasts'))
const Factors = lazy(() => import('@/pages/Factors'))
const History = lazy(() => import('@/pages/History'))
const Team = lazy(() => import('@/pages/Team'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const MenuItems = lazy(() => import('@/pages/MenuItems'))
const UploadDetail = lazy(() => import('@/pages/UploadDetail'))
const Integrations = lazy(() => import('@/pages/Integrations'))
const IntegrationCallback = lazy(() => import('@/pages/IntegrationCallback'))
const Improvements = lazy(() => import('@/pages/Improvements'))

const workforcePages = WORKFORCE_ENABLED
  ? {
      Roster: lazy(() => import('@/pages/Roster')),
      Staff: lazy(() => import('@/pages/Staff')),
      Leave: lazy(() => import('@/pages/Leave')),
    }
  : null

function RouteFallback() {
  return (
    <div className='min-h-screen bg-[#0F0F0F] flex items-center justify-center' role='status'>
      <div className='flex flex-col items-center gap-4'>
        <div className='w-8 h-8 border-2 border-guava-red/30 border-t-guava-red rounded-full animate-spin' />
        <p className='text-muted text-sm'>Loading portal...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-guava-red/30 border-t-guava-red rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to='/login' replace state={{ from: location.pathname + location.search }} />
  }

  return <>{children}</>
}

function ProtectedPage({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      <Route path="/" element={<Navigate to="/today" replace />} />

      <Route path="/today" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
      <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />

      <Route path="/planning" element={<ProtectedPage><Forecasts /></ProtectedPage>} />
      <Route path="/forecasts" element={<ProtectedPage><Forecasts /></ProtectedPage>} />
      <Route path="/planning/factors" element={<ProtectedPage><Factors /></ProtectedPage>} />
      <Route path="/factors" element={<ProtectedPage><Factors /></ProtectedPage>} />

      <Route path="/performance" element={<ProtectedPage><Analytics /></ProtectedPage>} />
      <Route path="/analytics" element={<ProtectedPage><Analytics /></ProtectedPage>} />
      <Route path="/history" element={<ProtectedPage><History /></ProtectedPage>} />

      <Route path="/ask-guava" element={<ProtectedPage><Insights /></ProtectedPage>} />
      <Route path="/insights" element={<ProtectedPage><Insights /></ProtectedPage>} />

      <Route path="/data-health" element={<ProtectedPage><Connect /></ProtectedPage>} />
      <Route path="/connect" element={<ProtectedPage><Connect /></ProtectedPage>} />
      <Route path="/data-health/menu-items" element={<ProtectedPage><MenuItems /></ProtectedPage>} />
      <Route path="/menu-items" element={<ProtectedPage><MenuItems /></ProtectedPage>} />

      <Route path="/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />
      <Route path="/improvements" element={<ProtectedPage><Improvements /></ProtectedPage>} />
      <Route path="/account" element={<ProtectedPage><Navigate to="/settings?section=account" replace /></ProtectedPage>} />
      <Route path="/team" element={<ProtectedPage><Team /></ProtectedPage>} />

      {workforcePages && (
        <>
          <Route path="/roster" element={<ProtectedPage><workforcePages.Roster /></ProtectedPage>} />
          <Route path="/staff" element={<ProtectedPage><workforcePages.Staff /></ProtectedPage>} />
          <Route path="/leave" element={<ProtectedPage><workforcePages.Leave /></ProtectedPage>} />
        </>
      )}

      <Route path="/uploads/:id" element={<ProtectedPage><UploadDetail /></ProtectedPage>} />

      <Route path="/integrations" element={<ProtectedPage><Integrations /></ProtectedPage>} />
      <Route path="/integrations/:provider/callback" element={<ProtectedPage><IntegrationCallback /></ProtectedPage>} />

      <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </Suspense>
  )
}
