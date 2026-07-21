import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import ProductImage from '../../components/ProductImage'
import { useToast } from '../../context/ToastContext'
import { useProducts } from '../../hooks/useProducts'
import { ApiError, apiFetch } from '../../lib/api'
import { formatCurrency } from '../../lib/format'
import type { NewProductInput, Product } from '../../lib/types'

interface SubmitError {
  kind: 'validation' | 'forbidden' | 'other'
  message: string
}

// 401 is deliberately absent from this list: apiFetch's own interceptor
// already owns that case end-to-end (silent refresh-and-retry, or a forced
// redirect to /login if the refresh itself fails) before an error ever
// reaches this form's catch block. Verified live for THIS endpoint
// specifically, not just the ones the interceptor was originally built
// against — see the write-up for how.
function categorizeSubmitError(err: unknown): SubmitError {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return {
        kind: 'forbidden',
        message: "You're signed in, but this account doesn't have permission to add products — admin access is required.",
      }
    }

    // The API returns validation failures as a bare 500 with a Mongoose-
    // shaped message, not a 400 — confirmed live (POST with a missing
    // `name` or a negative `price` both come back HTTP 500). That means a
    // validation failure and a genuine random server error are otherwise
    // indistinguishable by status code alone here, so detection falls back
    // to recognizing the message's shape instead.
    if (/validation failed/i.test(err.message)) {
      return { kind: 'validation', message: err.message.replace(/^Product validation failed:\s*/i, '') }
    }

    return { kind: 'other', message: err.message }
  }

  return { kind: 'other', message: 'Failed to create product' }
}

// Validates against the RAW STRINGS out of the inputs, not Number(price) /
// Number(quantity) — see the explanation of why type="number"'s value is
// not something you can trust as already-valid just because the browser
// accepted it. Returns null when valid, or a message to show the user.
function validateProductInput(price: string, quantity: string): string | null {
  // Price: optional leading digits, optional ".XX" with 1-2 decimal places.
  // Rejects: empty, negative sign, scientific notation ("1e3"), more than
  // 2 decimals, or anything that isn't plain digits/one dot.
  if (!/^\d+(\.\d{1,2})?$/.test(price.trim())) {
    return 'Price must be a non-negative number with at most 2 decimal places (e.g. 19.99).'
  }

  // Quantity: digits only. Rejects negative, decimals, scientific notation,
  // and empty — Number('') is 0, not NaN, so an empty field would otherwise
  // silently pass as "zero" instead of failing.
  if (!/^\d+$/.test(quantity.trim())) {
    return 'Quantity must be a non-negative whole number.'
  }

  return null
}

type SortColumn = 'name' | 'price' | 'quantity'
type SortDirection = 'asc' | 'desc'

interface SortState {
  column: SortColumn
  direction: SortDirection
}

// Click cycle: unsorted -> asc -> desc -> unsorted (back to server/natural
// order), rather than just asc<->desc, so there's always a way back to "no
// opinion" without reloading the page.
function nextSortState(current: SortState | null, column: SortColumn): SortState | null {
  if (!current || current.column !== column) return { column, direction: 'asc' }
  if (current.direction === 'asc') return { column, direction: 'desc' }
  return null
}

function sortIndicator(sort: SortState | null, column: SortColumn): string {
  if (sort?.column !== column) return '⇅'
  return sort.direction === 'asc' ? '▲' : '▼'
}

function parsePage(value: string | null): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

// Matches the API's fixed page size (see useProducts), so the skeleton rows
// are exactly as many as the real table — no extra reflow once data arrives.
const PAGE_SIZE = 20

function AdminProductsTableSkeleton() {
  return (
    <>
      {Array.from({ length: PAGE_SIZE }, (_, i) => (
        <tr key={i} className="animate-pulse border-b border-[var(--border)] last:border-0">
          <td className="px-4 py-3">
            <div className="size-12 rounded-lg bg-pink-light" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-40 rounded bg-pink-light" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-16 rounded bg-pink-light" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-10 rounded bg-pink-light" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 rounded bg-pink-light" />
          </td>
        </tr>
      ))}
    </>
  )
}

interface ProductFormProps {
  // Presence of `product` is the mode switch: undefined -> create (POST),
  // provided -> edit (PUT to that product's id), prefilled from its fields.
  product?: Product
  onSaved: (product: Product) => void
  onCancel?: () => void
  // Reports submitting state up to the parent table, which needs to know
  // (to disable Edit/Pagination while a submit is in flight — see the
  // audit note on why switching the form's target mid-submit is unsafe).
  onSubmittingChange?: (submitting: boolean) => void
  // Edit mode now renders inside a Modal, which supplies its own heading
  // and card chrome — these two flags let the same form drop its own
  // duplicate heading/border/padding rather than forking into two
  // near-identical components for "form with its own box" vs "form as
  // modal content".
  hideHeading?: boolean
  bare?: boolean
}

function ProductForm({ product, onSaved, onCancel, onSubmittingChange, hideHeading, bare }: ProductFormProps) {
  const isEditing = product !== undefined
  const { showToast } = useToast()

  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [quantity, setQuantity] = useState(product ? String(product.quantity) : '')
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<SubmitError | null>(null)

  // Same reasoning as useCheckout's guard: `disabled={submitting}` on the
  // button handles the common case, but the state update isn't applied to
  // the DOM synchronously, so a fast double-click (or a repeated Enter-key
  // submit) can still re-enter this function before React repaints. A ref
  // is read/written synchronously, closing that window completely.
  const submittingRef = useRef(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Checked before touching the network, and independent of whatever the
    // browser's own type="number" constraint validation decided — see the
    // explanation for why that alone isn't trustworthy here.
    const validationMessage = validateProductInput(price, quantity)
    if (validationMessage) {
      setFormError({ kind: 'validation', message: validationMessage })
      return
    }

    if (submittingRef.current) return
    submittingRef.current = true

    setSubmitting(true)
    onSubmittingChange?.(true)

    try {
      const payload = {
        name,
        price: Number(price),
        quantity: Number(quantity),
        imageUrl,
      } satisfies NewProductInput

      // apiFetch attaches the admin's JWT automatically — see the trace of
      // exactly where that happens (PR notes/README). Same seam for both
      // POST and PUT since both go through apiFetch identically.
      const saved = isEditing
        ? await apiFetch<Product>(`/api/products/${product._id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await apiFetch<Product>('/api/products', { method: 'POST', body: JSON.stringify(payload) })

      onSaved(saved)
      showToast(isEditing ? `"${saved.name}" updated` : `"${saved.name}" added`)

      if (!isEditing) {
        setName('')
        setPrice('')
        setQuantity('')
        setImageUrl('')
      }
    } catch (err) {
      setFormError(categorizeSubmitError(err))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
      onSubmittingChange?.(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={bare ? '' : 'card mb-6 p-6'}>
      {!hideHeading && <h2>{isEditing ? `Edit "${product.name}"` : 'New product'}</h2>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--text)]">Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            className="rounded-xl border border-[var(--border)] px-3.5 py-2.5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-gray-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--text)]">Price</span>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={submitting}
            className="rounded-xl border border-[var(--border)] px-3.5 py-2.5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-gray-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--text)]">Quantity</span>
          <input
            type="number"
            step="1"
            min="0"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={submitting}
            className="rounded-xl border border-[var(--border)] px-3.5 py-2.5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-gray-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--text)]">Image URL</span>
          <div className="flex items-center gap-3">
            <input
              type="text"
              required
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={submitting}
              className="flex-1 rounded-xl border border-[var(--border)] px-3.5 py-2.5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-gray-100"
            />
            {/* Live preview, keyed on the URL itself: without a key, a prior
                failed load's fallback swap (an imperative DOM mutation
                ProductImage makes outside React's props) could visually
                linger across an edit in some browsers/timings. Keying on
                the exact string forces a fresh <img> per distinct URL, so
                each edit always gets its own real load attempt rather than
                inheriting whatever the previous one's DOM ended up with. */}
            {imageUrl.trim() && (
              <ProductImage
                key={imageUrl}
                src={imageUrl}
                alt="Preview"
                className="size-14 shrink-0 rounded-lg border border-[var(--border)] object-cover"
              />
            )}
          </div>
        </label>
      </div>

      {formError && (
        <div
          className={`mt-3 rounded-xl px-4 py-3 text-sm ${
            formError.kind === 'forbidden'
              ? 'border border-red-200 bg-red-50 font-semibold text-red-700'
              : formError.kind === 'validation'
                ? 'border border-amber-200 bg-amber-50 text-amber-800'
                : 'text-red-600'
          }`}
        >
          {formError.kind === 'validation' && <span className="font-semibold">Check your input: </span>}
          {formError.message}
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? (isEditing ? 'Saving…' : 'Adding…') : isEditing ? 'Save changes' : 'Add product'}
        </button>
        {isEditing && onCancel && (
          <button type="button" onClick={onCancel} disabled={submitting} className="btn btn-outline">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

function AdminProducts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))

  // Same hook the public /products page uses — see the explanation of why
  // that's the right call rather than writing a second, admin-specific
  // fetch hook for the identical GET /api/products?page=&limit=20 request.
  const { data, loading, error, refetch } = useProducts(page)

  const { showToast } = useToast()

  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Optimistic UI: a row is hidden from the table THE INSTANT delete is
  // confirmed, before the DELETE request even resolves — not after. If the
  // request fails for a reason other than "already gone" (404), the id is
  // removed from this set again and the row reappears, with a toast
  // explaining why. A Set, not a single id, because two DIFFERENT rows can
  // be mid-delete at once — a single id would let the second delete's
  // cleanup accidentally re-show the first row while its request was still
  // in flight.
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set())

  // Lifted from ProductForm via onSubmittingChange — needed here so Edit
  // (which changes the form's `key`, unmounting it) and Pagination can be
  // disabled while a submit is in flight. See the audit note at the Edit
  // button for exactly what unmounting a submitting form would orphan.
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Patches specific rows in place from a PUT response, keyed by _id, without
  // refetching the whole page (no reason to reload 20 rows and flash the
  // skeleton to reflect a single row's edit). Merged with `data.products` at
  // render time rather than copied into its own synced copy of the list —
  // that would risk drifting from `data` after a page change or refetch;
  // reading `data.products` fresh on every render and only patching by id
  // can't go stale the same way. Entries here for products no longer on the
  // current page are simply never applied — harmless, no cleanup needed.
  const [overrides, setOverrides] = useState<Record<string, Product>>({})

  // Client-side only, deliberately: this sorts the 20 rows currently loaded
  // for this page, not the full catalog. See the explanation of why that's
  // the right call for this table specifically and where it stops being one.
  const [sort, setSort] = useState<SortState | null>(null)

  const goToPage = (nextPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(nextPage))
      return next
    })
  }

  // Deleting the only item on a page (most commonly the last page, but not
  // exclusively — see the write-up) leaves the current page number pointing
  // at nothing, even though earlier pages still have content. Step back
  // automatically rather than showing an empty table: the admin got here by
  // successfully deleting something, not by typing an invalid page number,
  // so this shouldn't look like an error state (unlike the public catalog's
  // out-of-range ?page=999 handling, which DOES show a message — there, the
  // user navigated to a page that was never valid; here, a page that WAS
  // valid became invalid as a direct result of the admin's own action).
  // Gated on `!loading`: `data` is stale-while-revalidating (see useProducts)
  // and still holds the pre-delete response until the refetch resolves, so
  // this only evaluates the ACTUAL post-delete result, never a transitional
  // one.
  useEffect(() => {
    if (!loading && data && data.products.length === 0 && page > 1) {
      goToPage(page - 1)
    }
  }, [loading, data, page])

  const handleProductCreated = () => {
    // A new product's sort position on the current page isn't known
    // locally, unlike an edit to an existing row — reload the current page
    // so it appears wherever the server actually places it.
    refetch()
  }

  const handleProductUpdated = (product: Product) => {
    setOverrides((prev) => ({ ...prev, [product._id]: product }))
    setEditingProduct(null)
  }

  const handleDelete = async (product: Product) => {
    // Explicit guard even though window.confirm() already blocks the main
    // thread for the real-browser double-click case — that protection is
    // an implicit side effect of confirm() being synchronous, not something
    // this code intentionally relies on. Checking the Set directly makes
    // the guarantee explicit and independent of that implementation detail.
    // (In practice it's also now unreachable via the UI once the row hides
    // itself below, but it stays as a defensive, implementation-independent
    // check rather than something that relies on that timing.)
    if (pendingDeletes.has(product._id)) return

    if (!window.confirm(`Delete "${product.name}"? This can't be undone.`)) return

    // Optimistic hide — see the state comment above for why this happens
    // before the request, not after.
    setPendingDeletes((prev) => new Set(prev).add(product._id))

    try {
      await apiFetch(`/api/products/${product._id}`, { method: 'DELETE' })
      showToast(`"${product.name}" deleted`)
      refetch()
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Someone else — another admin, another tab open on this same page —
        // already deleted it between when this row was fetched and when
        // Delete was clicked. The end state the user wanted (product gone)
        // is already true, so this isn't a failure to alarm them about, and
        // the optimistic hide above was actually correct — just say so and
        // resync the list so the row is replaced by the server's real state.
        showToast(`"${product.name}" was already deleted`)
        refetch()
        return
      }

      // Rollback: the delete did NOT actually happen, so the optimistic hide
      // was wrong — put the row back rather than leaving the admin staring
      // at a table that's silently lying about what's still in the catalog.
      setPendingDeletes((prev) => {
        const next = new Set(prev)
        next.delete(product._id)
        return next
      })
      showToast(`Failed to delete "${product.name}": ${err instanceof Error ? err.message : 'unknown error'}`)
    }
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

  // Merge overrides first, THEN sort — sorting a merged-but-stale row would
  // put it in the wrong position relative to values that only exist in
  // `overrides`. Safe to sort this array in place: .map() already returned
  // a fresh array, not the same reference as data.products. Optimistically-
  // deleted rows are filtered out here, ahead of both — a row mid-delete has
  // no business being sorted or patched, it's already "gone" as far as the
  // table is concerned.
  const displayedProducts = data?.products
    .filter((fetched) => !pendingDeletes.has(fetched._id))
    .map((fetched) => overrides[fetched._id] ?? fetched) ?? []
  if (sort) {
    displayedProducts.sort((a, b) => {
      const cmp = sort.column === 'name' ? a.name.localeCompare(b.name) : a[sort.column] - b[sort.column]
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }

  return (
    <div className="px-6 py-8 text-left">
      <h1>Admin · Products</h1>

      <div className="mt-4">
        <ProductForm onSaved={handleProductCreated} onSubmittingChange={setFormSubmitting} />
      </div>

      {/* Edit now opens as a floating dialog over the page instead of
          re-purposing the create form up top — the admin no longer has to
          look away from the row they clicked Edit on to find where the
          form went. closeDisabled while formSubmitting for the same reason
          Edit is disabled on the table below: closing (and unmounting)
          this form mid-request would orphan its in-flight apiFetch promise
          and let a stale onSaved/setFormError fire after the admin thinks
          they closed it. */}
      {editingProduct && (
        <Modal title={`Edit "${editingProduct.name}"`} onClose={() => setEditingProduct(null)} closeDisabled={formSubmitting}>
          {/* key forces a fresh instance per target — see the explanation of
              why prop reuse alone doesn't reset the form's internal state
              when switching from editing one product straight to another. */}
          <ProductForm
            key={editingProduct._id}
            product={editingProduct}
            onSaved={handleProductUpdated}
            onCancel={() => setEditingProduct(null)}
            onSubmittingChange={setFormSubmitting}
            hideHeading
            bare
          />
        </Modal>
      )}

      <div className="card overflow-x-auto">
        {/* min-w forces genuine horizontal scroll on narrow screens instead
            of every column silently shrinking/wrapping into an unreadable
            mess — the overflow-x-auto wrapper above only helps once there's
            actually something wider than the viewport to scroll. */}
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-pink-light/40 text-xs font-bold uppercase tracking-wide text-primary">
            <tr>
              <th className="px-4 py-3">Image</th>
              {(['name', 'price', 'quantity'] as const).map((column) => (
                <th
                  key={column}
                  className="px-4 py-3"
                  aria-sort={sort?.column === column ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    onClick={() => setSort((prev) => nextSortState(prev, column))}
                    className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-primary hover:text-primary-dark"
                  >
                    {column}
                    <span className="text-[10px]">{sortIndicator(sort, column)}</span>
                  </button>
                </th>
              ))}
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {loading ? (
              <AdminProductsTableSkeleton />
            ) : (
              displayedProducts.map((product) => {
                return (
                  <tr key={product._id} className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-pink-light/30">
                    <td className="px-4 py-3">
                      <ProductImage src={product.imageUrl} alt={product.name} className="size-12 rounded-lg object-cover" />
                    </td>
                    <td className="px-4 py-3 font-medium">{product.name}</td>
                    <td className="px-4 py-3">{formatCurrency(product.price)}</td>
                    <td className="px-4 py-3">{product.quantity}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        {/* Disabled while ANY submit is in flight, not just
                            edits of this row: clicking Edit changes
                            editingProduct, which changes ProductForm's key,
                            which UNMOUNTS the in-flight form instance. Its
                            apiFetch promise keeps running in the background
                            (unmounting doesn't cancel it) and its onSaved/
                            setFormError closures still fire when it
                            resolves — updating overrides or calling
                            refetch() on behalf of a form the admin thinks
                            they abandoned. Blocking Edit during any submit
                            closes that window entirely. */}
                        <button
                          onClick={() => setEditingProduct(product)}
                          disabled={formSubmitting}
                          className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-primary/30 disabled:no-underline"
                        >
                          Edit
                        </button>
                        {/* No disabled/"Deleting…" state needed: once a
                            delete is confirmed, the row is hidden (see
                            pendingDeletes) rather than left visible in a
                            pending state — this button unmounts along with
                            the rest of the row the instant that happens. */}
                        <button onClick={() => handleDelete(product)} className="font-semibold text-red-600 hover:underline">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Also disabled during a form submit or any in-flight delete — not a
          correctness necessity the way blocking Edit is (navigating pages
          doesn't orphan a form the way remounting it does), but changing
          the page mid-mutation can race with the auto-back-navigation
          effect above and land the admin somewhere confusing while a
          request they just fired is still resolving. */}
      <Pagination
        page={page}
        totalPages={data?.totalPages}
        onPageChange={goToPage}
        disabled={loading || formSubmitting || pendingDeletes.size > 0}
      />
    </div>
  )
}

export default AdminProducts
