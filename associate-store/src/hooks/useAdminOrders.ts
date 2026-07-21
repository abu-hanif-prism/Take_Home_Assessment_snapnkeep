import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { AdminOrder } from '../lib/types'

interface UseAdminOrdersResult {
  orders: AdminOrder[] | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// Same request-lifecycle shape as useProducts (abort on unmount/retry,
// cancel-stale-response guards, retry via a bumped counter) even though
// GET /api/orders has no pagination to cancel between — the correctness
// concerns (a slow response landing after a newer request, or after the
// component's gone) apply regardless of whether the endpoint paginates.
export function useAdminOrders(): UseAdminOrdersResult {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setError(null)

    apiFetch<AdminOrder[]>('/api/orders', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setOrders(result)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Failed to load orders')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [retryCount])

  const refetch = () => setRetryCount((count) => count + 1)

  return { orders, loading, error, refetch }
}
