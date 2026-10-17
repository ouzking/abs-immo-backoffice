import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import { useConfirm } from '@/components/ui/Confirm'

/** Demande confirmation avant de quitter une page dont le formulaire a des modifications non enregistrées. */
export function useUnsavedChangesGuard(dirty: boolean) {
  const confirm = useConfirm()
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void confirm({
      title: 'Quitter sans enregistrer ?',
      description: 'Vos modifications seront perdues.',
      confirmLabel: 'Quitter la page',
      cancelLabel: 'Rester',
      tone: 'danger',
    }).then((ok) => (ok ? blocker.proceed() : blocker.reset()))
  }, [blocker, confirm])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
}
