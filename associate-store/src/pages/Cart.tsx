import { Link } from 'react-router-dom'
import ProductImage from '../components/ProductImage'
import { useCart } from '../context/CartContext'
import { ORDER_RETRIES, useCheckout } from '../hooks/useCheckout'
import { formatCurrency } from '../lib/format'

const inputClassName =
  'rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-gray-100'

function Cart() {
  const {
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
  } = useCheckout()

  // useCheckout only exposes what checkout itself needs (items/total for the
  // read-only summary); quantity edits and removal go straight through
  // CartContext, same as everywhere else in the app that mutates the cart.
  const { updateQuantity, removeFromCart } = useCart()

  if (confirmation) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-left">
        <div className="card p-8">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
            Order confirmed
          </span>
          <h1>Thanks for your order!</h1>
          <p className="text-[var(--text)]">
            Order ID: <span className="font-mono">{confirmation.orderId}</span>
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {confirmation.items.map((item) => (
              <div key={item.product._id} className="flex items-center gap-4 border-b border-[var(--border)] pb-3">
                <ProductImage src={item.product.imageUrl} alt={item.product.name} className="size-14 shrink-0 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-[var(--text)]">
                    Qty {item.quantity} × {formatCurrency(item.product.price)}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(item.product.price * item.quantity)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-lg font-semibold text-primary">
            <span>Total</span>
            <span>{formatCurrency(confirmation.total)}</span>
          </div>

          <Link to="/products" className="btn btn-primary mt-6">
            Continue shopping
          </Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16">
        <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-pink-light text-3xl">
          🛍
        </span>
        <p>Your cart is empty.</p>
        <Link to="/products" className="btn btn-primary">
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-left">
      <h1>Cart</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div className="card p-6">
          <div className="flex flex-col gap-4">
            {items.map((item) => {
              // Stock may have dropped since this was added (see the
              // revalidate-on-load sync that runs when /cart opens) — 0
              // means the product is still in the cart but can't have its
              // quantity changed, only removed. Not silently hidden: the
              // customer should see WHY the steppers are disabled.
              const outOfStock = item.product.quantity === 0

              return (
                <div
                  key={item.product._id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] pb-4 last:border-0 last:pb-0"
                >
                  <ProductImage src={item.product.imageUrl} alt={item.product.name} className="size-14 shrink-0 rounded-lg object-cover" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.product.name}</p>
                    <p className="text-sm text-[var(--text)]">{formatCurrency(item.product.price)} each</p>
                    {outOfStock && <p className="text-xs font-semibold text-red-600">Out of stock</p>}
                  </div>

                  <div className="flex items-center rounded-full border border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product._id, item.quantity - 1)}
                      disabled={item.quantity <= 1 || outOfStock}
                      aria-label={`Decrease quantity of ${item.product.name}`}
                      className="grid size-9 place-items-center rounded-full text-base font-bold text-ink transition-colors hover:bg-pink-light disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product._id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.quantity}
                      aria-label={`Increase quantity of ${item.product.name}`}
                      className="grid size-9 place-items-center rounded-full text-base font-bold text-ink transition-colors hover:bg-pink-light disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      +
                    </button>
                  </div>

                  <p className="w-20 text-right font-semibold">{formatCurrency(item.product.price * item.quantity)}</p>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product._id)}
                    aria-label={`Remove ${item.product.name} from cart`}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--text)] transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12.1a2 2 0 0 1-2 1.9H9.7a2 2 0 0 1-2-1.9L7 7h10Z" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4 text-lg font-semibold text-primary">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <section className="card p-6">
          <h2>Checkout</h2>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--text)]">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                className={inputClassName}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--text)]">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className={inputClassName}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--text)]">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
                className={inputClassName}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--text)]">Address</span>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={submitting}
                className={inputClassName}
              />
            </label>

            {orderError && <p className="text-sm text-red-600">{orderError}</p>}

            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting
                ? retryInfo
                  ? `Retrying… attempt ${retryInfo.attempt} of ${ORDER_RETRIES}`
                  : 'Placing order…'
                : orderError
                  ? 'Try again'
                  : 'Place order'}
            </button>

            {retryInfo && (
              // key={retryInfo.attempt} forces a fresh DOM node per attempt,
              // so the CSS animation restarts from 0% instead of jumping or
              // continuing a finished one when animation-duration changes.
              // A CSS *animation* is used rather than a *transition* because
              // a transition needs its 0%-width starting state to have
              // already painted before the change to 100% — with a freshly
              // mounted element there's no prior paint to interpolate from,
              // so nothing would visibly move. An animation plays from its
              // `from` keyframe the instant it's inserted, no such trick needed.
              <div className="h-1 w-full overflow-hidden rounded-full bg-pink-light" aria-hidden="true">
                <div
                  key={retryInfo.attempt}
                  className="retry-progress-bar h-full bg-primary"
                  style={{ animationDuration: `${retryInfo.delay}ms` }}
                />
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  )
}

export default Cart
