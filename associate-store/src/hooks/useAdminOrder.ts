import { useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../lib/api'
import type { AdminOrder } from '../lib/types'

interface UseAdminOrderResult {
  order: AdminOrder | null
  loading: boolean
  error: string | null
  // Separate from `error`: a 404 here means "this order genuinely doesn't
  // exist" (deleted, bad id, stale link), not "something went wrong" — the
  // page needs to tell those apart to show a not-found state instead of a
  // Retry button that would just 404 again forever.
  notFound: boolean
  refetch: () => void
}

// Same lifecycle shape as useAdminOrders/useProducts — see those for why
// (abort-on-unmount, cancel-stale-response guards, retry via a counter).
export function useAdminOrder(id: string): UseAdminOrderResult {
  const [order, setOrder] = useState<AdminOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setError(null)
    setNotFound(false)

    apiFetch<AdminOrder>(`/api/orders/${id}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setOrder(result)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (controller.signal.aborted) return

        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load order')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [id, retryCount])

  const refetch = () => setRetryCount((count) => count + 1)

  return { order, loading, error, notFound, refetch }
}
