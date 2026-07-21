import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useCart, type CartItem } from '../context/CartContext'
import { useReturningCustomer } from '../context/CustomerContext'
import { useToast } from '../context/ToastContext'
import { apiFetch } from '../lib/api'
import { retryWithBackoff } from '../lib/retry'
import type { Order, OrderInput } from '../lib/types'

// Matches the exact schedule retryWithBackoff produces with baseDelay=500:
// 500ms, 1s, 2s, 4s.
export const ORDER_RETRIES = 4

export interface OrderConfirmation {
  orderId: string
  items: CartItem[]
  total: number
}

export interface RetryInfo {
  attempt: number
  delay: number
}

interface UseCheckoutResult {
  items: CartItem[]
  total: number

  name: string
  setName: (value: string) => void
  email: string
  setEmail: (value: string) => void
  phone: string
  setPhone: (value: string) => void
  address: string
  setAddress: (value: string) => void

  submitting: boolean
  retryInfo: RetryInfo | null
  orderError: string | null
  confirmation: OrderConfirmation | null

  handleSubmit: (e: FormEvent) => void
}

export function useCheckout(): UseCheckoutResult {
  const { items, clearCart, syncWithCatalog } = useCart()
  const { showToast } = useToast()
  const { isReturningCustomer, markAsReturningCustomer } = useReturningCustomer()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [retryInfo, setRetryInfo] = useState<RetryInfo | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null)

  // Double-submit guard, separate from the `submitting` state below.
  // `disabled={submitting}` on the button/fields (rendered by the page)
  // handles the common case, but a state update isn't applied to the DOM
  // synchronously — between the first click and the next render actually
  // disabling the button, there's a window where a fast second click (or a
  // double-click, or an Enter-key repeat) can still re-enter handleSubmit.
  // A ref is read and written synchronously, so checking it at the very
  // top of handleSubmit, before any `await` or state update, closes that
  // window completely.
  const submittingRef = useRef(false)

  // Revalidate-on-load: check the cart against the live catalog every time
  // this hook mounts (i.e. every time /cart is opened) — not on every cart
  // mutation elsewhere in the app, which would mean N product-detail
  // requests on every add/remove. Empty dependency array is intentional:
  // re-running this on every `items` change would re-fetch the whole cart
  // after every single sync-triggered update, which is wasteful and
  // pointless right after we just synced.
  //
  // AbortController here for the same reason every other data-fetching
  // effect in this app has one: without it, StrictMode's dev-only
  // double-invoke (mount → cleanup → mount) fires this cart's N
  // GET /api/products/:id calls TWICE back to back — a real duplicate-calls
  // finding, not hypothetical. Aborting the first run's in-flight requests
  // on cleanup, and ignoring an aborted run's results, closes it the same
  // way useProducts/useAdminOrders/useAdminOrder already do.
  useEffect(() => {
    if (items.length === 0) return

    const controller = new AbortController()

    syncWithCatalog(controller.signal).then(({ removedNames }) => {
      if (controller.signal.aborted) return
      removedNames.forEach((productName) =>
        showToast(`"${productName}" is no longer available and was removed from your cart`),
      )
    })

    return () => {
      controller.abort()
    }
  }, [])

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Synchronous guard — must be the very first thing checked/set, before
    // any `await` or setState, so a second invocation racing in before
    // React re-renders the disabled button is rejected unconditionally.
    if (submittingRef.current) return
    submittingRef.current = true

    setSubmitting(true)
    setOrderError(null)
    setRetryInfo(null)

    try {
      // ── Idempotency, or the lack of it (teaching note, not implemented) ──
      //
      // Every retry attempt below is a BRAND NEW POST /api/orders — the
      // server has no way to tell "this is a fresh order" apart from "this
      // is client retrying the same order because it didn't hear back."
      // That distinction only matters in one specific scenario: the server
      // successfully creates the order (its write commits), but the
      // RESPONSE never makes it back to the client — a dropped connection,
      // a killed tab, a timeout on a slow network. From the client's point
      // of view that is indistinguishable from a genuine failure: no 2xx
      // was received, so retryWithBackoff (correctly, by its own contract)
      // tries again. If that retry ALSO succeeds, two orders now exist for
      // one checkout — a "placed-but-unconfirmed" order silently became a
      // "placed-twice" order. This is a different failure mode from the
      // "persists nothing on 500" guarantee this specific API documents:
      // that guarantee covers the explicit-500 case we've been designing
      // around, not a genuinely-succeeded-response-lost-in-transit case,
      // which is a network-layer problem no amount of "check the status
      // code" logic can see, because no status code ever arrived.
      //
      // The double-submit guard above prevents the USER from causing this
      // (two clicks -> two intents); it does nothing for the network
      // dropping a response the client already legitimately sent once.
      //
      // Real payment APIs close this gap with an idempotency key: the
      // client generates one random key ONCE per logical operation (e.g.
      // a UUID), before the first attempt, and sends the SAME key on every
      // retry of that same operation (Stripe: an `Idempotency-Key` header;
      // this is now common practice across payment/order APIs generally).
      // The server persists, alongside the key, the result of the first
      // request it processes with that key. Any later request carrying a
      // key it has already completed does not re-run the operation at
      // all — it just replays the ORIGINAL response. A request still being
      // processed under that key causes the duplicate to wait/reject
      // rather than race it. The effect: the operation is guaranteed to
      // execute AT MOST ONCE no matter how many times the client resends
      // it, so the client is freed from ever having to determine "did that
      // actually go through?" before deciding it's safe to retry — retrying
      // is unconditionally safe by construction, because the server (not
      // the client, and not a UI guard like the one above) owns the
      // guarantee.
      //
      // This API has no such mechanism (no idempotency-key header is
      // documented or accepted) — worth naming as a real, unresolved gap
      // for this take-home's scope rather than pretending the UI-level
      // guard above closes it, because it doesn't.
      const order = await retryWithBackoff(
        () =>
          apiFetch<Order>('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
              products: items.map((item) => ({ product: item.product._id, quantity: item.quantity })),
              name,
              email,
              phone,
              address,
              // Reflects order history BEFORE this submission — a customer
              // isn't "recurring" on the strength of the order that might
              // be their first. Read once at submit time via the hook, not
              // re-derived after success.
              recurring_customer: isReturningCustomer,
            } satisfies OrderInput),
          }),
        {
          retries: ORDER_RETRIES,
          baseDelay: 500,
          onAttempt: (attempt, _error, delay) => setRetryInfo({ attempt, delay }),
        },
      )

      // Snapshot the items/total being purchased BEFORE clearCart() wipes
      // them — order._id is the only useful field on the API response for
      // display purposes (its `products` is just {product: id, quantity},
      // no name/price), so the confirmation view is built from what we
      // already know locally, not from re-deriving it off the response.
      setConfirmation({ orderId: order._id, items, total })
      markAsReturningCustomer()
      clearCart()
      setName('')
      setEmail('')
      setPhone('')
      setAddress('')
    } catch (err) {
      // Cart and form are deliberately left untouched here — see the
      // explanation of why losing what the user typed would be the worst
      // possible outcome of a failed submit. The message itself leads with
      // reassurance (nothing was lost) before the technical detail, since
      // that's the first thing an anxious "did my order go through?" user
      // needs to know.
      const detail = err instanceof Error ? err.message : 'an unexpected error'
      setOrderError(`We couldn't place your order after several attempts (${detail}). Your cart and details are unchanged — please try again.`)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
      setRetryInfo(null)
    }
  }

  return {
    items,
    total,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    address,
    setAddress,
    submitting,
    retryInfo,
    orderError,
    confirmation,
    handleSubmit,
  }
}
