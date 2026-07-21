import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Pagination from '../components/Pagination'
import ProductImage from '../components/ProductImage'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useProducts } from '../hooks/useProducts'
import { formatCurrency } from '../lib/format'
import { stockStatus } from '../lib/stock'
import type { Product } from '../lib/types'

function parsePage(value: string | null): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

// Matches the API's fixed page size (see useProducts), so the skeleton grid
// is exactly as tall as the real one — no extra reflow once data arrives.
const PAGE_SIZE = 20

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 text-left sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: PAGE_SIZE }, (_, i) => (
        <div key={i} className="card flex animate-pulse flex-col gap-2 p-4">
          <div className="aspect-square w-full rounded-xl bg-pink-light" />
          <div className="h-5 w-3/4 rounded bg-pink-light" />
          <div className="h-4 w-1/3 rounded bg-pink-light" />
          <div className="h-4 w-1/2 rounded bg-pink-light" />
        </div>
      ))}
    </div>
  )
}

// Thin line-art icons, not emoji: emoji render as inconsistent, over-
// literal clip art depending on the OS/browser's own emoji font — the exact
// "doesn't match the site's vibe" problem. These share the same stroke
// weight/style as the cart and menu icons already used in the navbar, so
// the icon language stays consistent across the whole app.
function ShippingIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h10v8H3V7ZM13 10h4l3.5 3.5V15H13v-5ZM6.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  )
}
function CheckoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12.5 9 17l11-11" />
    </svg>
  )
}
function SecureIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5 18.5 6v5.5c0 4.5-2.8 7.3-6.5 9-3.7-1.7-6.5-4.5-6.5-9V6L12 3.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2.2 2.2L15.5 10" />
    </svg>
  )
}

const FEATURES = [
  { Icon: ShippingIcon, text: 'Free shipping over $50' },
  { Icon: CheckoutIcon, text: 'Simple, honest checkout' },
  { Icon: SecureIcon, text: 'Secure by design' },
]

// Shared so both slides sit at the same height in the carousel track — a
// slide-to-slide height jump would look broken, not "artistic".
const SLIDE_HEIGHT = 'min-h-[420px] sm:min-h-[460px]'

function MainSlide() {
  return (
    <div className={`relative flex h-full ${SLIDE_HEIGHT} flex-col justify-center overflow-hidden bg-[#2b0f1c] px-6 py-14 text-left sm:px-14 sm:py-20`}>
      {/* Base wash: darker and more layered than a flat brand-color fill, so
          the blobs/grid below have somewhere moody to sit rather than
          floating on a single flat gradient. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-dark via-primary to-[#3d0f24]"
      />
      <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-0 opacity-[0.06]" />

      {/* Three color washes drifting on independent, never-synced paths —
          see the animation write-up in index.css for why three and why
          this slow. Mixed warm (pink/amber) and cool (violet) so the blend
          shifts hue as they cross, not just position. */}
      <div
        aria-hidden="true"
        className="aurora-a pointer-events-none absolute -right-20 -top-24 size-96 rounded-full bg-pink opacity-40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="aurora-b pointer-events-none absolute -bottom-28 -left-10 size-80 rounded-full bg-amber-300 opacity-[0.18] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="aurora-c pointer-events-none absolute bottom-0 right-1/4 size-72 rounded-full bg-violet-400 opacity-20 blur-3xl"
      />

      {/* Large faint ring, slowly rotating — a quiet decorative flourish
          rather than another color blob, cropped off the top-right edge so
          it reads as part of the composition, not a floating circle. */}
      <div
        aria-hidden="true"
        className="hero-ring pointer-events-none absolute -right-24 -top-32 size-[26rem] rounded-full border border-white/10"
      />

      <p className="relative mb-3 inline-block w-fit rounded-full bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-wide text-pink-light ring-1 ring-white/15">
        New arrivals every week
      </p>
      <h1 className="relative max-w-xl !text-white">
        Everything you need, all in one{' '}
        <span className="bg-gradient-to-r from-pink-light via-pink to-amber-200 bg-clip-text text-transparent">store</span>
      </h1>
      <p className="relative max-w-md text-base text-white/70">
        Browse our full catalog of quality products, picked and stocked just for you.
      </p>
      <a href="#product-grid" className="btn btn-primary relative mt-7 w-fit !bg-white !text-primary hover:!bg-white">
        Shop now
      </a>
    </div>
  )
}

// The second slide — this is where the "Free shipping / honest checkout /
// secure" promise used to live, crammed into three lines of fine print at
// the bottom of the main banner. It gets its own full slide here instead:
// its own color story (amber/gold rather than the main slide's deep plum,
// so the carousel actually reads as two distinct banners, not one banner
// repeated) and room for each item to be a real callout, not a footnote.
function FeaturesSlide() {
  return (
    <div
      className={`relative flex h-full ${SLIDE_HEIGHT} flex-col justify-center overflow-hidden bg-gradient-to-br from-amber-600 via-primary-light to-primary px-6 py-14 text-left sm:px-14 sm:py-20`}
    >
      <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-0 opacity-[0.08]" />
      <div
        aria-hidden="true"
        className="aurora-a pointer-events-none absolute -left-16 -top-20 size-80 rounded-full bg-white opacity-20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="aurora-c pointer-events-none absolute -bottom-24 right-10 size-72 rounded-full bg-primary-dark opacity-30 blur-3xl"
      />

      <p className="relative mb-4 inline-block w-fit rounded-full bg-white/15 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white ring-1 ring-white/25">
        Why shop with us
      </p>
      <h1 className="relative max-w-lg !text-white">Every order, backed by the basics done right</h1>

      <div className="relative mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.text}
            className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3.5 backdrop-blur-md transition-colors hover:bg-white/[0.14]"
          >
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/20">
              <feature.Icon />
            </span>
            <span className="text-sm font-semibold text-white">{feature.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const SLIDES = [MainSlide, FeaturesSlide]
const SLIDE_INTERVAL_MS = 6000

function HeroCarousel() {
  const [active, setActive] = useState(0)

  // Restarts on every `active` change (auto-advance or a manual dot click
  // both set it), so a manual pick always gets the full interval before the
  // next auto-advance rather than being cut short by whatever was already
  // mid-countdown. Skipped entirely for prefers-reduced-motion — an
  // auto-advancing carousel is exactly the kind of motion that setting is
  // meant to suppress.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), SLIDE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [active])

  return (
    <div className="mx-4 mt-4 sm:mx-6 sm:mt-6">
      <div className="relative overflow-hidden rounded-3xl">
        <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${active * 100}%)` }}>
          {SLIDES.map((Slide, i) => (
            <div key={i} className="w-full shrink-0">
              <Slide />
            </div>
          ))}
        </div>
      </div>

      <div role="tablist" aria-label="Promotional banners" className="mt-4 flex items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active === i}
            aria-label={`Show banner ${i + 1} of ${SLIDES.length}`}
            onClick={() => setActive(i)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              active === i ? 'w-6 bg-primary' : 'w-2.5 bg-pink-light hover:bg-pink'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))

  const { data, loading, error, refetch } = useProducts(page)
  const cart = useCart()
  const { showToast } = useToast()

  const goToPage = (nextPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(nextPage))
      return next
    })
  }

  const handleAddToCart = (product: Product) => {
    cart.addToCart(product)
    showToast(`Added "${product.name}" to cart`)
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

  // The API returns 200 with an empty products array for a page past the end
  // (e.g. ?page=999), not an error — so this is checked separately from
  // `error` above. totalPages > 0 excludes the genuinely-empty-catalog case,
  // where page 1 itself has no products and "go to page 1" would be useless.
  if (!loading && data && data.totalPages > 0 && page > data.totalPages) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16">
        <p>Page {page} doesn't exist. This catalog only has {data.totalPages} page{data.totalPages === 1 ? '' : 's'}.</p>
        <Link to="/products?page=1" className="font-semibold text-primary">
          Go to page 1
        </Link>
      </div>
    )
  }

  return (
    <div className="pb-12">
      <HeroCarousel />

      {/* `isolate` matters here, not just decoration: without it establishing
          a stacking context, the blobs' negative z-index below has nothing
          local to sink behind — it escapes past this whole section and
          paints behind the page's own background, i.e. invisible. Found by
          confirming via computed styles that the elements existed with the
          right styles and still rendered nothing. */}
      <div id="product-grid" className="relative isolate px-6 py-10">
        {/* Placed directly in this section (not a global fixed position) so
            they're guaranteed to land in visible white space instead of
            behind the opaque header/hero — see the write-up on why the
            first attempt at a page-wide wash didn't work. Large blur radius
            means no hard edge to worry about clipping against the grid. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-10 -z-10 size-80 rounded-full bg-pink-light opacity-70 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 top-72 -z-10 size-72 rounded-full bg-primary/[0.07] blur-3xl"
        />

        <div className="mb-6 flex items-end justify-between text-left">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Catalog</p>
            <h2 className="!mb-0">Our Products</h2>
          </div>
        </div>

        {loading ? (
          <ProductGridSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-6 text-left sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {data?.products.map((product) => {
              const stock = stockStatus(product.quantity)

              return (
                <div key={product._id} className="card card-hover group flex flex-col gap-2 p-4">
                  {/* `contents` keeps the Link out of the flex layout (it
                      wraps two children but shouldn't itself become a flex
                      item) while still making the image+name one clickable
                      region — the accessible route to the detail page/
                      quantity picker. "Add to cart" below is a SIBLING, not
                      nested inside this link, so it stays its own separate
                      control rather than an interactive-inside-interactive
                      element. */}
                  <Link to={`/products/${product._id}`} className="contents">
                    <div className="relative overflow-hidden rounded-xl bg-pink-light">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold ${stock.className}`}>
                        {stock.text}
                      </span>
                    </div>
                    <h2 className="text-lg !mb-0 transition-colors group-hover:text-primary">{product.name}</h2>
                  </Link>
                  <p className="text-lg font-bold text-primary">{formatCurrency(product.price)}</p>
                  {product.description && <p className="text-sm text-[var(--text)]">{product.description}</p>}
                  <button onClick={() => handleAddToCart(product)} disabled={product.quantity === 0} className="btn btn-primary mt-auto w-full">
                    Add to cart
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <Pagination page={page} totalPages={data?.totalPages} onPageChange={goToPage} disabled={loading} />
      </div>
    </div>
  )
}

export default Products
