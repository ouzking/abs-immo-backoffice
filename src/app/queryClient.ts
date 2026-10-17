import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { notifySessionExpired } from '@/lib/authEvents'
import { toAppError } from '@/lib/errors'

function handleGlobalError(error: unknown) {
  if (toAppError(error).kind === 'auth') notifySessionExpired()
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleGlobalError }),
    mutationCache: new MutationCache({ onError: handleGlobalError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          const kind = toAppError(error).kind
          // Inutile de réessayer un refus de droits ou une donnée invalide.
          if (kind === 'forbidden' || kind === 'not_found' || kind === 'validation' || kind === 'auth' || kind === 'business') {
            return false
          }
          return failureCount < 2
        },
      },
      mutations: { retry: false },
    },
  })
}
