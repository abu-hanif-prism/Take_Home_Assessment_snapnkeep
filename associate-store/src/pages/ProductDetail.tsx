import { Link, useParams } from 'react-router-dom'
import ProductImage from '../components/ProductImage'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useProduct } from '../hooks/useProduct'
import { formatCurrency } from '../lib/format'
import { stockStatus } from '../lib/stock'

// The live API has no `description` field (confirmed against GET /api/products
// — see the README assumption) — this is shown only when a product doesn't
// carry a real one, clearly labeled as placeholder rather than pretending
// it's real catalog copy. For the same reason, this page also deliberately
// has no star rating / review count / "was $X, now $Y" discount strip: this
// API has no review data and no discount field, and fabricating those (unlike
// clearly-labeled lorem ipsum) would be presenting invented numbers as real.
const PLACEHOLDER_DESCRIPTION =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'

const stepperControlClassName =
  'grid size-9 place-items-center text-lg font-bold text-primary transition-colors hover:bg-pink-light disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'

function ProductDetail() {
  // Route is /products/:id (App.tsx) — only ever rendered on a match, so
  // `id` is always a real string at runtime even though useParams() types
  // it as optional (TypeScript has no way to see the route/component pairing).
  const { id } = useParams<{ id: string }>()
  const { product, loading, error, notFound, refetch } = useProduct(id ?? '')
  const { items, addToCart, updateQuantity, removeFromCart } = useCart()
  const { showToast } = useToast()

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16">
        <p>This product doesn't exist — it may have been removed, or the link is incorrect.</p>
        <Link to="/products" className="btn btn-primary">
          Back to products
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

  if (loading || !product) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="card grid animate-pulse grid-cols-1 gap-0 overflow-hidden p-0 sm:grid-cols-2">
          <div className="aspect-square bg-pink-light" />
          <div className="flex flex-col gap-3 p-6">
            <div className="h-7 w-3/4 rounded bg-pink-light" />
            <div className="h-9 w-1/2 rounded bg-pink-light" />
            <div className="h-20 rounded bg-pink-light" />
          </div>
        </div>
      </div>
    )
  }

  const stock = stockStatus(product.quantity)
  const outOfStock = product.quantity === 0
  const description = product.description?.trim() || PLACEHOLDER_DESCRIPTION

  // Live cart quantity, not a page-local draft: this control directly reads
  // and writes CartContext, the same "ADD → becomes a stepper" pattern most
  // grocery/quick-commerce apps use, so what's on screen is always exactly
  // what's in the cart rather than a separate number the customer has to
  // "commit" with a big Add to Cart button.
  const cartItem = items.find((item) => item.product._id === product._id)
  const cartQuantity = cartItem?.quantity ?? 0

  const handleAdd = () => {
    addToCart(product, 1)
    showToast(`Added "${product.name}" to cart`)
  }

  const decrement = () => {
    if (cartQuantity <= 1) {
      removeFromCart(product._id)
      return
    }
    updateQuantity(product._id, cartQuantity - 1)
  }

  const increment = () => updateQuantity(product._id, cartQuantity + 1)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-left">
      <Link to="/products" className="text-sm font-semibold text-primary hover:underline">
        ← Back to products
      </Link>

      <div className="card mt-4 grid grid-cols-1 overflow-hidden p-0 sm:grid-cols-2">
        <div className="relative bg-pink-light">
          <ProductImage src={product.imageUrl} alt={product.name} className="aspect-square w-full object-cover" />
          <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${stock.className}`}>
            {stock.text}
          </span>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <h1 className="!text-2xl">{product.name}</h1>

          <div className="flex items-center justify-between gap-4">
            <p className="text-2xl font-bold text-primary">{formatCurrency(product.price)}</p>

            {/* Same control, two shapes: a compact ADD pill when this
                product isn't in the cart yet, morphing into a −/qty/+
                stepper the instant it is — rather than a separate
                "Quantity" section plus a big "Add to cart" button below it. */}
            {outOfStock ? (
              <span className="rounded-xl border-2 border-[var(--border)] px-5 py-1.5 text-sm font-bold uppercase tracking-wide text-[var(--text)]/50">
                Sold out
              </span>
            ) : cartQuantity === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                className="rounded-xl border-2 border-primary px-6 py-1.5 text-sm font-extrabold uppercase tracking-wide text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Add
              </button>
            ) : (
              <div className="inline-flex items-center overflow-hidden rounded-xl border-2 border-primary">
                <button type="button" onClick={decrement} aria-label={`Decrease quantity of ${product.name}`} className={stepperControlClassName}>
                  −
                </button>
                <span className="w-8 text-center text-sm font-extrabold text-primary" aria-live="polite">
                  {cartQuantity}
                </span>
                <button
                  type="button"
                  onClick={increment}
                  disabled={cartQuantity >= product.quantity}
                  aria-label={`Increase quantity of ${product.name}`}
                  className={stepperControlClassName}
                >
                  +
                </button>
              </div>
            )}
          </div>
          {!outOfStock && product.quantity < 5 && <p className="-mt-2 text-xs text-amber-600">Only {product.quantity} available.</p>}

          <div className="border-t border-[var(--border)] pt-4">
            <h2 className="!text-base">Details</h2>
            <p className="text-sm text-[var(--text)]">{description}</p>
            {!product.description && (
              <p className="mt-1 text-xs italic text-[var(--text)]/70">
                Placeholder text — the product catalog doesn't include a real description for this item.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail
