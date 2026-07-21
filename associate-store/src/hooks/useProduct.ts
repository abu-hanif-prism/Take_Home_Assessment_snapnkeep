import { useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../lib/api'
import type { Product } from '../lib/types'

interface UseProductResult {
  product: Product | null
  loading: boolean
  error: string | null
  // Separate from `error`: a 404 means this product was deleted or the link/
  // id is wrong, not "something went wrong" — the page needs to tell those
  // apart to show a not-found state instead of a Retry button that would
  // just 404 again forever.
  notFound: boolean
  refetch: () => void
}

// Same request-lifecycle shape as useAdminOrder/useProducts (abort-on-
// unmount, cancel-stale-response guards, retry via a counter) — see those
// for the full reasoning.
export function useProduct(id: string): UseProductResult {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setError(null)
    setNotFound(false)

    apiFetch<Product>(`/api/products/${id}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setProduct(result)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (controller.signal.aborted) return

        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load product')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [id, retryCount])

  const refetch = () => setRetryCount((count) => count + 1)

  return { product, loading, error, notFound, refetch }
}
