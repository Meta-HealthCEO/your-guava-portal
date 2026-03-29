import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  Upload,
  Sparkles,
  Settings,
  LogOut,
  Coffee,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Forecasts', to: '/forecasts', icon: TrendingUp },
  { label: 'Connect Data', to: '/connect', icon: Upload },
  { label: 'Insights', to: '/insights', icon: Sparkles },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-[#111111] border-r border-[#2A2A2A] flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-7 h-7 rounded-md bg-[#D43D3D] flex items-center justify-center flex-shrink-0">
            <Coffee className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#D43D3D] font-bold text-base tracking-tight">
            Your Guava
          </span>
        </div>
        <p className="text-[#555555] text-xs ml-9 truncate">
          {user?.name ?? 'Loading...'}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group relative',
                isActive
                  ? 'bg-[#D43D3D]/10 text-[#D43D3D] border-l-2 border-[#D43D3D] pl-[10px]'
                  : 'text-[#888888] hover:text-[#F0F0F0] hover:bg-white/5 border-l-2 border-transparent'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'w-4 h-4 flex-shrink-0',
                    isActive ? 'text-[#D43D3D]' : 'text-[#888888] group-hover:text-[#F0F0F0]'
                  )}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="px-3 pb-4 pt-3 border-t border-[#2A2A2A]">
        <div className="px-3 py-2 mb-1">
          <p className="text-[#F0F0F0] text-sm font-medium truncate">{user?.name ?? '—'}</p>
          <p className="text-[#555555] text-xs truncate">{user?.email ?? '—'}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#888888] hover:text-[#F0F0F0] hover:bg-white/5 transition-colors group"
        >
          <LogOut className="w-4 h-4 flex-shrink-0 group-hover:text-red-400 transition-colors" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
