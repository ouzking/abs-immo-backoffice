import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { ConfirmProvider } from '@/components/ui/Confirm'
import { env } from '@/config/env'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ConfigErrorScreen } from './ConfigErrorScreen'
import { createQueryClient } from './queryClient'
import { router } from './router'

export function App() {
  const [queryClient] = useState(createQueryClient)
  if (!env.isSupabaseConfigured) return <ConfigErrorScreen />
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </AuthProvider>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ classNames: { toast: 'font-sans', title: 'font-semibold' } }}
      />
    </QueryClientProvider>
  )
}
