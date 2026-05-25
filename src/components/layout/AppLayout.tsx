import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { TopToolbar } from './TopToolbar'

interface AppLayoutProps {
  children: ReactNode
  title?: ReactNode
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="xl:ml-60 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-12.25 flex items-center justify-between gap-3 px-4 xl:px-8 bg-[#0F0F0F]/90 backdrop-blur-sm border-b border-border shrink-0">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="xl:hidden text-muted hover:text-text p-1.5 -ml-1.5"
            >
              <Menu className="w-5 h-5" />
            </button>
            {title && (
              <div className="text-text text-lg xl:text-xl font-semibold tracking-tight flex min-w-0 items-center gap-2 truncate">
                {title}
              </div>
            )}
          </div>
          <TopToolbar />
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 xl:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
