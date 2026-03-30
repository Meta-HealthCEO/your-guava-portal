import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  children: ReactNode
  title?: ReactNode
  actions?: ReactNode
}

export function AppLayout({ children, title, actions }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="xl:ml-[240px] flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-[49px] flex items-center justify-between px-4 xl:px-8 bg-[#0F0F0F]/90 backdrop-blur-sm border-b border-[#2A2A2A] shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="xl:hidden text-[#888888] hover:text-[#F0F0F0] p-1.5 -ml-1.5"
            >
              <Menu className="w-5 h-5" />
            </button>
            {title && (
              <div className="text-[#F0F0F0] text-lg xl:text-xl font-semibold tracking-tight flex items-center gap-2">
                {title}
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 xl:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
