import { Link, useSearchParams } from 'react-router-dom'
import Pagination from '../components/Pagination'
import { useProducts } from '../hooks/useProducts'

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const FALLBACK_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"%3E%3Crect width="600" height="600" fill="%23f4f3ec"/%3E%3Ctext x="50%25" y="50%25" font-family="sans-serif" font-size="28" fill="%236b6375" text-anchor="middle" dominant-baseline="middle"%3EImage unavailable%3C/text%3E%3C/svg%3E'

const LOW_STOCK_THRESHOLD = 5

function stockStatus(quantity: number): { text: string; className: string } {
  if (quantity === 0) {
    return { text: 'Out of stock', className: 'text-red-600' }
  }
  if (quantity < LOW_STOCK_THRESHOLD) {
    return { text: `Only ${quantity} left`, className: 'text-amber-600' }
  }
  return { text: 'In stock', className: 'text-green-600' }
}

function parsePage(value: string | null): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

// Matches the API's fixed page size (see useProducts), so the skeleton grid
// is exactly as tall as the real one — no extra reflow once data arrives.
const PAGE_SIZE = 20

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-6 text-left md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: PAGE_SIZE }, (_, i) => (
        <div key={i} className="flex animate-pulse flex-col gap-2 rounded border border-gray-200 p-4">
          <div className="aspect-square w-full rounded bg-gray-200" />
          <div className="h-5 w-3/4 rounded bg-gray-200" />
          <div className="h-4 w-1/3 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  )
}

function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))

  const { data, loading, error, refetch } = useProducts(page)

  const goToPage = (nextPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(nextPage))
      return next
    })
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16">
        <p className="text-red-600">{error}</p>
        <button onClick={refetch} className="rounded bg-blue-600 px-4 py-2 text-white">
          Retry
        </button>
      </div>
    )
  }

  // The API returns 200 with an empty products array for a page past the end
  // (e.g. ?page=999), not an error — so this is checked separately from
  // `error` above. totalPages > 0 excludes the genuinely-empty-catalog case,
  // where page 1 itself has no products and "go to page 1" would be useless.
  if (!loading && data && data.totalPages > 0 && page > data.totalPages) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16">
        <p>Page {page} doesn't exist. This catalog only has {data.totalPages} page{data.totalPages === 1 ? '' : 's'}.</p>
        <Link to="/products?page=1" className="text-blue-600">
          Go to page 1
        </Link>
      </div>
    )
  }

  return (
    <div className="px-6 py-8">
      <h1>Products</h1>

      {loading ? (
        <ProductGridSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-6 text-left md:grid-cols-3 lg:grid-cols-4">
          {data?.products.map((product) => {
            const stock = stockStatus(product.quantity)

            return (
              <div key={product._id} className="flex flex-col gap-2 rounded border border-gray-200 p-4">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="aspect-square w-full rounded object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = FALLBACK_IMAGE
                  }}
                />
                <h2 className="text-lg">{product.name}</h2>
                <p className="font-semibold">{currencyFormatter.format(product.price)}</p>
                <p className={`text-sm ${stock.className}`}>{stock.text}</p>
                {product.description && <p className="text-sm text-gray-600">{product.description}</p>}
              </div>
            )
          })}
        </div>
      )}

      <Pagination page={page} totalPages={data?.totalPages} onPageChange={goToPage} disabled={loading} />
    </div>
  )
}

export default Products
