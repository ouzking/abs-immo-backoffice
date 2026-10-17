import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PASSWORD_RULES } from '../schemas'

export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="grid grid-cols-2 gap-1.5 text-xs" aria-label="Exigences du mot de passe">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value ?? '')
        return (
          <li key={rule.label} className={cn('flex items-center gap-1.5', ok ? 'text-success-700' : 'text-mist-500')}>
            {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
            {rule.label}
            <span className="sr-only">{ok ? ' : respecté' : ' : non respecté'}</span>
          </li>
        )
      })}
    </ul>
  )
}
