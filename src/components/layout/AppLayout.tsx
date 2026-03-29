import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  children: ReactNode
  title?: ReactNode
  actions?: ReactNode
}

export function AppLayout({ children, title, actions }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      <Sidebar />

      <div className="ml-[240px] flex flex-col min-h-screen">
        {/* Top Bar */}
        {(title || actions) && (
          <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 bg-[#0F0F0F]/90 backdrop-blur-sm border-b border-[#2A2A2A]">
            {title && (
              <div className="text-[#F0F0F0] text-xl font-semibold tracking-tight flex items-center gap-2">
                {title}
              </div>
            )}
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </header>
        )}

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
