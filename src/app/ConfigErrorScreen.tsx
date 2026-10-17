import { Settings2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'

/** Affiché si les variables VITE_SUPABASE_* manquent (au lieu d'une page blanche). */
export function ConfigErrorScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-mist-50 p-6">
      <div className="w-full max-w-lg rounded-card border border-mist-200 bg-white p-8 shadow-soft">
        <Logo className="h-12" />
        <div className="mt-6 flex items-center gap-2 text-brand-red-700">
          <Settings2 className="h-5 w-5" aria-hidden />
          <h1 className="text-lg font-bold">Configuration incomplète</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-mist-600">
          Les variables <code className="rounded bg-mist-100 px-1">VITE_SUPABASE_URL</code> et{' '}
          <code className="rounded bg-mist-100 px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code> ne sont pas définies. Copiez{' '}
          <code className="rounded bg-mist-100 px-1">.env.example</code> vers{' '}
          <code className="rounded bg-mist-100 px-1">.env.local</code>, renseignez la clé publique du projet Supabase, puis
          relancez l'application.
        </p>
      </div>
    </div>
  )
}
