import { type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

// Pages
import Login from '@/pages/auth/Login'
import Signup from '@/pages/auth/Signup'
import Dashboard from '@/pages/Dashboard'
import Connect from '@/pages/Connect'
import Insights from '@/pages/Insights'
import Settings from '@/pages/Settings'
import Forecasts from '@/pages/Forecasts'
import Factors from '@/pages/Factors'
import History from '@/pages/History'
import Team from '@/pages/Team'
import Analytics from '@/pages/Analytics'
import MenuItems from '@/pages/MenuItems'
import Roster from '@/pages/Roster'
import Staff from '@/pages/Staff'
import Leave from '@/pages/Leave'
import UploadDetail from './pages/UploadDetail'
import Integrations from '@/pages/Integrations'
import IntegrationCallback from '@/pages/IntegrationCallback'
import Improvements from '@/pages/Improvements'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-guava-red/30 border-t-guava-red rounded-full animate-spin" />
          <p className="text-[#555555] text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function ProtectedPage({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

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

      <Route path="/roster" element={<ProtectedPage><Roster /></ProtectedPage>} />
      <Route path="/staff" element={<ProtectedPage><Staff /></ProtectedPage>} />
      <Route path="/leave" element={<ProtectedPage><Leave /></ProtectedPage>} />

      <Route path="/uploads/:id" element={<ProtectedPage><UploadDetail /></ProtectedPage>} />

      <Route path="/integrations" element={<ProtectedPage><Integrations /></ProtectedPage>} />
      <Route path="/integrations/:provider/callback" element={<ProtectedPage><IntegrationCallback /></ProtectedPage>} />

      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  )
}
