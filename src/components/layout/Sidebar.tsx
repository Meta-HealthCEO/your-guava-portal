import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  Upload,
  Sparkles,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import guavaIcon from '@/assets/guava-icon.png'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

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

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [cafeName, setCafeName] = useState('')

  useEffect(() => {
    api.get('/cafe/me').then(({ data }) => {
      setCafeName(data?.cafe?.name || '')
    }).catch(() => {})
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleNavClick = () => {
    // Close mobile sidebar on navigation
    onClose?.()
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 xl:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-[240px] bg-[#111111] border-r border-[#2A2A2A] flex flex-col z-50 transition-transform duration-200',
          // Mobile: hidden by default, shown when isOpen
          'max-xl:-translate-x-full',
          isOpen && 'max-xl:translate-x-0',
          // Desktop: always visible
          'xl:translate-x-0'
        )}
      >
        {/* Logo — aligned with top bar height */}
        <div className="h-[49px] px-4 flex items-center justify-between border-b border-[#2A2A2A] shrink-0">
          <div className="flex items-center gap-2.5">
            <img src={guavaIcon} alt="" className="w-8 h-8 object-contain shrink-0" />
            <div>
              <div style={{ fontFamily: "'Fredoka', sans-serif" }} className="leading-none">
                <span className="text-[#6B8E3A] text-base font-bold">Your</span>{' '}
                <span className="text-[#C62828] text-base font-bold">Guava</span>
              </div>
              <p className="text-[#999999] text-[10px] leading-tight mt-0.5">{cafeName || ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="xl:hidden text-[#555555] hover:text-[#F0F0F0] p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={handleNavClick}
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
                      'w-4 h-4 shrink-0',
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
            <LogOut className="w-4 h-4 shrink-0 group-hover:text-red-400 transition-colors" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
