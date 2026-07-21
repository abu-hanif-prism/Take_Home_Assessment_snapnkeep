import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { PaginatedProducts } from '../lib/types'

interface UseProductsResult {
  data: PaginatedProducts | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useProducts(page: number): UseProductsResult {
  const [data, setData] = useState<PaginatedProducts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // ── Request lifecycle ────────────────────────────────────────────────
  //
  // 1. MOUNT (or `page` / `retryCount` changes)
  //    React (re)runs this effect. A fresh AbortController is created —
  //    this one effect run "owns" it; no other run can trigger it.
  //
  // 2. FETCH
  //    loading -> true, error -> null, then apiFetch fires with this run's
  //    signal attached. The request is now in flight.
  //
  // 3a. PAGE CHANGES BEFORE THE REQUEST RESOLVES → ABORT
  //    Before React runs the effect again for the new `page`, it calls
  //    THIS run's cleanup function: controller.abort(). That does two
  //    things — tells the browser to actually cancel the in-flight HTTP
  //    request (not merely ignore its result — the connection is torn
  //    down), and makes the pending fetch() promise reject with an
  //    AbortError. The .catch() below recognizes that and returns without
  //    setting `error`, since a cancelled-on-purpose request isn't a
  //    failure. Step 1 then repeats for the new `page`: new controller,
  //    new request, loading flips back to true.
  //
  // 3b. REQUEST RESOLVES NORMALLY (page didn't change)
  //    .then() stores the parsed PaginatedProducts, .finally() flips
  //    loading off. Every handler still checks controller.signal.aborted
  //    first — belt-and-suspenders, since a response already in flight
  //    when abort() fires can, depending on browser/timing, still resolve
  //    successfully rather than reject. The guard makes correctness
  //    independent of exactly how reliably cancellation propagates.
  //
  // 4. REFETCH (manual retry)
  //    refetch() doesn't call apiFetch itself — it bumps `retryCount`,
  //    which sits in the dependency array below. That change re-enters
  //    this same effect from step 1 (new controller, new request), so
  //    retry reuses the exact same fetch/abort/guard logic instead of a
  //    duplicated code path.
  //
  // 5. UNMOUNT
  //    Same cleanup path as 3a — controller.abort() cancels whatever's
  //    still in flight, so a late response can never call setState on an
  //    unmounted component.
  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setError(null)

    apiFetch<PaginatedProducts>(`/api/products?page=${page}&limit=20`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Failed to load products')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [page, retryCount])

  const refetch = () => setRetryCount((count) => count + 1)

  return { data, loading, error, refetch }
}
