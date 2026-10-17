import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { ExternalLink, Menu } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { env } from '@/config/env'
import { cn } from '@/lib/cn'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'

const COLLAPSE_KEY = 'abs-bo:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* stockage indisponible : préférence non mémorisée */
    }
  }, [collapsed])

  // Remonte en haut de page à chaque navigation.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-dvh">
      <a
        href="#contenu"
        className="sr-only z-50 rounded-lg bg-navy-700 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Aller au contenu
      </a>

      {/* Barre latérale fixe (≥ lg) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      </aside>

      {/* Tiroir de navigation (< lg) */}
      <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menu" variant="drawer" size="sm" bare>
        <div className="h-full">
          <Sidebar collapsed={false} mobile onNavigate={() => setMobileOpen(false)} />
        </div>
      </Dialog>

      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[76px]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-mist-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-mist-600 hover:bg-mist-100 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          {env.publicSiteUrl && (
            <a
              href={env.publicSiteUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-mist-600 hover:bg-mist-100 hover:text-ink sm:flex"
            >
              Site public
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
          <div className="h-6 w-px bg-mist-200" aria-hidden />
          <UserMenu />
        </header>

        <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
