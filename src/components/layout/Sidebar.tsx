import { NavLink } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchSidebarCounters } from '@/features/leads/api'
import { cn } from '@/lib/cn'
import { NAVIGATION } from './navigation'
import { Logo } from './Logo'

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  mobile = false,
}: {
  collapsed: boolean
  onToggleCollapsed?: () => void
  onNavigate?: () => void
  mobile?: boolean
}) {
  const { canAny } = useAuth()
  const canSeeLeads = canAny(['leads.access_assigned', 'leads.read_all'])
  const counters = useQuery({
    queryKey: ['sidebar-counters'],
    queryFn: fetchSidebarCounters,
    enabled: canSeeLeads,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const isCollapsed = collapsed && !mobile

  return (
    <div className="flex h-full flex-col bg-navy-900 text-navy-100">
      <div className={cn('flex h-16 shrink-0 items-center border-b border-white/10', isCollapsed ? 'justify-center px-2' : 'px-5')}>
        <div className={cn('flex items-center rounded-lg bg-white shadow-sm', isCollapsed ? 'p-1' : 'px-3 py-1.5')}>
          <Logo className={isCollapsed ? 'h-6' : 'h-8'} />
        </div>
        {!isCollapsed && (
          <span className="ml-3 text-[11px] leading-tight font-bold tracking-[0.14em] text-navy-300 uppercase">
            Back
            <br />
            office
          </span>
        )}
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        {NAVIGATION.map((section) => {
          const items = section.items.filter((i) => canAny(i.anyOf))
          if (items.length === 0) return null
          return (
            <div key={section.label} className="mb-5">
              {isCollapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
              ) : (
                <p className="mb-1.5 px-3 text-[10.5px] font-bold tracking-[0.16em] text-navy-400 uppercase">{section.label}</p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const count = item.counter ? counters.data?.[item.counter] : undefined
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onNavigate}
                        title={isCollapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-lg text-sm font-semibold transition-colors',
                            isCollapsed ? 'h-10 justify-center' : 'h-10 px-3',
                            isActive ? 'bg-white/10 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-brand-red-500" aria-hidden />}
                            <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-white' : 'text-navy-300 group-hover:text-white')} aria-hidden />
                            {isCollapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                            {!!count && (
                              <span
                                className={cn(
                                  'tabular rounded-full bg-brand-red-600 text-[10.5px] font-bold text-white',
                                  isCollapsed ? 'absolute top-1 right-1 min-w-4 px-1 text-center' : 'ml-auto px-1.5 py-0.5',
                                )}
                                aria-label={`${count} en attente`}
                              >
                                {count > 99 ? '99+' : count}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {onToggleCollapsed && !mobile && (
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-lg text-sm font-medium text-navy-300 hover:bg-white/5 hover:text-white',
              isCollapsed ? 'justify-center' : 'px-3',
            )}
            aria-label={isCollapsed ? 'Déplier le menu' : 'Replier le menu'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            {!isCollapsed && 'Replier le menu'}
          </button>
        </div>
      )}
    </div>
  )
}
