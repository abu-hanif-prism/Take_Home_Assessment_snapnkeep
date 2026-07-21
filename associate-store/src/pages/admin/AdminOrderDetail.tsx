import { Link, useParams } from 'react-router-dom'
import ProductImage from '../../components/ProductImage'
import { useAdminOrder } from '../../hooks/useAdminOrder'
import { formatCurrency, formatDate } from '../../lib/format'

function AdminOrderDetail() {
  // The route is registered as /admin/orders/:id (App.tsx) — this component
  // only ever renders when that segment matched, so `id` is always a real
  // string at runtime. useParams() still types it as `string | undefined`
  // because TypeScript has no way to see that route/component pairing —
  // see the explanation for why that's a reasonable thing for the type to
  // insist on regardless.
  const { id } = useParams<{ id: string }>()
  const { order, loading, error, notFound, refetch } = useAdminOrder(id ?? '')

  // Checked before the generic error branch: a 404 means the order was
  // deleted, the id is wrong, or the link is stale — none of which a Retry
  // button can fix (it would just 404 again). A distinct not-found state
  // with a way back is the honest response, same reasoning as the public
  // catalog's out-of-range ?page=999 handling.
  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16">
        <p>This order doesn't exist — it may have been deleted, or the link is incorrect.</p>
        <Link to="/admin/orders" className="btn btn-primary">
          Back to orders
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16">
        <p className="text-red-600">{error}</p>
        <button onClick={refetch} className="btn btn-primary">
          Retry
        </button>
      </div>
    )
  }

  if (loading || !order) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse px-6 py-8 text-left">
        <div className="h-8 w-64 rounded bg-pink-light" />
        <div className="mt-6 h-40 rounded-2xl bg-pink-light" />
        <div className="mt-6 h-40 rounded-2xl bg-pink-light" />
      </div>
    )
  }

  // ASSUMPTION (documented in README): this uses item.product.price, which
  // is the product's CURRENT price from the populated document, not a price
  // stored on the order at checkout time — the order schema has no per-line
  // price field (confirmed: {product: <id>, quantity} is all POST /api/orders
  // accepts, and GET /api/orders/:id's populated product is the live catalog
  // document). If a product's price changes after an order is placed, this
  // total silently recomputes using the NEW price, not what the customer
  // actually paid. Verified live: editing a product's price and reloading an
  // existing order that included it changed the displayed total to match.
  const total = order.products.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 text-left">
      <Link to="/admin/orders" className="text-sm font-semibold text-primary hover:underline">
        ← Back to orders
      </Link>

      <h1 className="mt-2">Order details</h1>
      <p className="text-sm text-[var(--text)]">
        Order ID: <span className="font-mono">{order._id}</span>
      </p>

      {/* Same "New"/"Returning" signal the storefront navbar shows the
          customer themselves (useReturningCustomer/CustomerContext) — here
          it's the headline of the page rather than a corner pill, since an
          admin scanning this order cares about it as much as who placed it. */}
      <div
        className={`mt-4 flex items-center gap-3 rounded-2xl border px-5 py-4 ${
          order.recurring_customer ? 'border-green-100 bg-green-50' : 'border-[var(--border)] bg-pink-light/40'
        }`}
      >
        {/* Decorative — the text next to it already says "Returning"/"New
            Customer", so a screen reader announcing the raw glyph on top of
            that would just be noise. */}
        <span
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${
            order.recurring_customer ? 'bg-green-100 text-green-700' : 'bg-pink-light text-primary'
          }`}
        >
          {order.recurring_customer ? '↻' : '✦'}
        </span>
        <div>
          <p className={`text-sm font-bold uppercase tracking-wide ${order.recurring_customer ? 'text-green-700' : 'text-primary'}`}>
            {order.recurring_customer ? 'Returning Customer' : 'New Customer'}
          </p>
          <p className="text-sm text-[var(--text)]">
            {order.recurring_customer
              ? 'This customer has ordered from us before.'
              : "This is this customer's first order with us."}
          </p>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h2>Customer</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--text)]">Name</dt>
            <dd className="font-medium">{order.name}</dd>
          </div>
          <div>
            <dt className="text-[var(--text)]">Email</dt>
            <dd className="font-medium">{order.email}</dd>
          </div>
          <div>
            <dt className="text-[var(--text)]">Phone</dt>
            <dd className="font-medium">{order.phone}</dd>
          </div>
          <div>
            <dt className="text-[var(--text)]">Placed</dt>
            <dd className="font-medium">{formatDate(order.createdAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--text)]">Address</dt>
            <dd className="font-medium">{order.address}</dd>
          </div>
        </dl>
      </div>

      <div className="card mt-6 p-6">
        <h2>Items</h2>
        <div className="flex flex-col gap-3">
          {order.products.map((item) => (
            <div key={item.product._id} className="flex items-center gap-4 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
              <ProductImage src={item.product.imageUrl} alt={item.product.name} className="size-12 rounded-lg object-cover" />
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
        <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4 text-lg font-semibold text-primary">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  )
}

export default AdminOrderDetail
