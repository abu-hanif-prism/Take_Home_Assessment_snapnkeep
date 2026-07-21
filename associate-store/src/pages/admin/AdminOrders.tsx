import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminOrders } from '../../hooks/useAdminOrders'
import { formatDate } from '../../lib/format'
import type { AdminOrder } from '../../lib/types'

// Total UNITS ordered, not the number of distinct line items — see the
// explanation of why order.products.length would be the wrong number here.
function itemCount(order: AdminOrder): number {
  return order.products.reduce((sum, item) => sum + item.quantity, 0)
}

const SKELETON_ROWS = 8

function AdminOrdersTableSkeleton() {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <tr key={i} className="animate-pulse border-b border-[var(--border)] last:border-0">
          <td className="px-4 py-3">
            <div className="h-4 w-32 rounded bg-pink-light" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-40 rounded bg-pink-light" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-28 rounded bg-pink-light" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-10 rounded bg-pink-light" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 rounded bg-pink-light" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-36 rounded bg-pink-light" />
          </td>
        </tr>
      ))}
    </>
  )
}

function AdminOrders() {
  const { orders, loading, error, refetch } = useAdminOrders()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

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

  // GET /api/orders returns everything in one unpaginated array (confirmed
  // live: ?page=&limit= params are silently ignored), so client-side
  // sorting is squarely the "fine" case — the full dataset being sorted is
  // already what's in memory, nothing is being reordered ahead of data that
  // hasn't been fetched yet. No API-side createdAt ordering is guaranteed,
  // so newest-first is applied here rather than assumed from response order.
  const sortedOrders = orders ? [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : []

  // Client-side, per-keystroke, no debounce — see the explanation for why
  // that's a non-issue at this scale (filtering an in-memory array already
  // fetched in full, same reasoning as the sorting above).
  const query = search.trim().toLowerCase()
  const visibleOrders = query
    ? sortedOrders.filter((order) => order.name.toLowerCase().includes(query) || order.email.toLowerCase().includes(query))
    : sortedOrders

  return (
    <div className="px-6 py-8 text-left">
      <h1>Admin · Orders</h1>

      {/* Hidden once we know there's nothing to search — a search box over an
          empty table invites typing into a box that can only ever say "no
          matches" for a reason unrelated to the search itself. */}
      {(loading || sortedOrders.length > 0) && (
        <div className="mt-4 max-w-sm sm:max-w-md">
          {/* sr-only, not a placeholder: placeholder text vanishes the moment
              something is typed and isn't reliably exposed as an accessible
              name by every screen reader — WCAG 1.3.1/2.4.6 want a real label. */}
          <label htmlFor="order-search" className="sr-only">
            Search orders by customer name or email
          </label>
          <input
            id="order-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or email…"
            className="w-full rounded-xl border border-[var(--border)] px-3.5 py-2.5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
      )}

      <div className="card mt-4 overflow-x-auto">
        {/* min-w forces genuine horizontal scroll on narrow screens instead
            of every column silently shrinking/wrapping into an unreadable
            mess — the overflow-x-auto wrapper above only helps once there's
            actually something wider than the viewport to scroll. */}
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-pink-light/40 text-xs font-bold uppercase tracking-wide text-primary">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Placed</th>
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {loading ? (
              <AdminOrdersTableSkeleton />
            ) : sortedOrders.length === 0 ? (
              // Genuinely zero orders in the system — distinct from "search
              // matched nothing" below, since there's no search to blame here.
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-[var(--text)]">
                  <p className="font-medium">No orders yet.</p>
                  <p className="mt-1 text-sm">Orders will show up here once customers start checking out.</p>
                </td>
              </tr>
            ) : visibleOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text)]">
                  No orders match "{search}".
                </td>
              </tr>
            ) : (
              visibleOrders.map((order) => (
                // onClick on the row is a mouse-only convenience (click
                // anywhere in the row) — it is NOT the accessible control.
                // A <tr> has no interactive semantics of its own, and giving
                // it one via role="button" would strip its real ARIA "row"
                // role, breaking the column associations a screen reader
                // relies on. The actual keyboard/screen-reader target is the
                // real <button> in the Name cell below — one clear tab stop
                // per row instead of an unlabeled, non-standard row-as-button.
                <tr
                  key={order._id}
                  onClick={() => navigate(`/admin/orders/${order._id}`)}
                  className="cursor-pointer border-b border-[var(--border)] transition-colors last:border-0 hover:bg-pink-light/30"
                >
                  <td className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/orders/${order._id}`)}
                      className="rounded text-left hover:underline"
                    >
                      {order.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">{order.email}</td>
                  <td className="px-4 py-3">{order.phone}</td>
                  <td className="px-4 py-3">{itemCount(order)}</td>
                  <td className="px-4 py-3">
                    {order.recurring_customer ? (
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
                        Returning
                      </span>
                    ) : (
                      <span className="rounded-full bg-pink-light px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                        New
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text)]">{formatDate(order.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminOrders
