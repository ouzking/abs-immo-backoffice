import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { Avatar } from '@/components/ui/Misc'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/cn'
import { labelOf, ROLES } from '@/lib/labels'

export function UserMenu() {
  const { access, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!access) return null
  const name = access.full_name || access.email || 'Utilisateur'
  const role = labelOf(ROLES, access.roles[0])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 hover:bg-mist-100"
      >
        <Avatar name={name} size="sm" />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-40 truncate text-sm leading-tight font-semibold text-ink">{name}</span>
          <span className="block text-[11px] leading-tight text-mist-500">{role}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-mist-400 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 animate-fade-in rounded-xl border border-mist-200 bg-white p-1.5 shadow-lift">
          <div className="border-b border-mist-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-mist-500">{access.email}</p>
            <p className="mt-1.5 text-[11px] font-bold tracking-wide text-navy-700 uppercase">{access.roles.map((r) => labelOf(ROLES, r)).join(' · ')}</p>
          </div>
          <Link
            to="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-mist-50"
          >
            <UserRound className="h-4 w-4 text-mist-500" aria-hidden />
            Mon profil et sécurité
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-red-700 hover:bg-brand-red-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
