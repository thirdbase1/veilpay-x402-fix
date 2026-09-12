'use client'

import { useState, createContext, useContext, type ReactNode } from 'react'
import { DashboardSidebar } from './sidebar'
import { X } from 'lucide-react'

interface DashboardNavContextValue {
  openMobileMenu: () => void
  closeMobileMenu: () => void
  isMobileOpen: boolean
}

const DashboardNavContext = createContext<DashboardNavContextValue>({
  openMobileMenu: () => {},
  closeMobileMenu: () => {},
  isMobileOpen: false,
})

export function useDashboardNav() {
  return useContext(DashboardNavContext)
}

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <DashboardNavContext.Provider
      value={{
        openMobileMenu: () => setMobileOpen(true),
        closeMobileMenu: () => setMobileOpen(false),
        isMobileOpen: mobileOpen,
      }}
    >
      <div className="flex min-h-screen bg-background text-foreground antialiased">
        {/* Desktop Sidebar */}
        <div className="hidden md:block shrink-0">
          <DashboardSidebar />
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileOpen(false)}
            />

            {/* Drawer */}
            <div className="fixed inset-y-0 left-0 w-72 bg-card border-r border-border shadow-2xl flex flex-col z-10">
              <div className="absolute right-3 top-4">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                  aria-label="Close navigation"
                >
                  <X className="size-4" />
                </button>
              </div>
              <DashboardSidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Workspace Area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Veil-lift: one-time redaction reveal on load */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
            <div className="veil-lift-overlay absolute inset-0" />
            <div className="veil-lift-edge absolute inset-x-0 bottom-0 h-24" />
          </div>
          {children}
        </div>
      </div>
    </DashboardNavContext.Provider>
  )
}
