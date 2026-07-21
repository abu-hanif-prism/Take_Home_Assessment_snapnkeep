import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useReturningCustomer } from '../context/CustomerContext'
import Footer from './Footer'

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-pink-light text-primary' : 'text-ink/70 hover:bg-pink-light/60 hover:text-primary'
  }`

const mobileNavLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
    isActive ? 'bg-pink-light text-primary' : 'text-ink/70 hover:bg-pink-light/60 hover:text-primary'
  }`

function Layout() {
  const { user, logout } = useAuth()
  const { items } = useCart()
  const { isReturningCustomer } = useReturningCustomer()
  const navigate = useNavigate()

  // Collapsed nav toggle — only rendered/relevant below the `md` breakpoint;
  // see the mobile-pass write-up for why `md` (not `sm`) is where the full
  // inline nav (logo + links + customer badge + user/login) stops fitting.
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  const handleLogout = () => {
    logout()
    closeMenu()
    navigate('/products')
  }

  // Derived, not stored: computed fresh from `items` on every render, so it
  // can never drift out of sync with the cart it's describing. See the
  // explanation of why a separate `count` state would be a bug.
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  // Deliberately NOT styled like the buttons/nav pills around it — this is a
  // status readout ("is this browser recognized as having ordered before?"),
  // not a control. A bold rounded pill in the same spot as Log in/nav links
  // reads as clickable; a small dot + plain label doesn't.
  const customerBadge = (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text)]">
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${isReturningCustomer ? 'bg-green-500' : 'bg-primary'}`}
      />
      {isReturningCustomer ? 'Returning customer' : 'New customer'}
    </span>
  )

  return (
    <>
      <div className="bg-primary px-4 py-2 text-center text-xs font-semibold tracking-wide text-white">
        Free shipping on orders over $50
      </div>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <NavLink to="/products" className="mr-2 flex items-center gap-2 text-left" onClick={closeMenu}>
            <span className="grid size-9 place-items-center rounded-full bg-primary font-heading text-base font-bold text-white">
              A
            </span>
            <span className="font-heading text-lg font-bold text-ink">Associate Store</span>
          </NavLink>

          {/* Full inline nav: only from `md` up. Below that it moves into the
              collapsible panel so it doesn't wrap or overflow the header. */}
          <nav className="hidden gap-1 md:flex">
            <NavLink to="/products" className={navLinkClassName}>
              Products
            </NavLink>
            <NavLink to="/cart" className={navLinkClassName}>
              <span className="inline-flex items-center gap-1.5">
                Cart
                {totalItems > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                    {totalItems}
                  </span>
                )}
              </span>
            </NavLink>
            {user?.role === 'admin' && (
              <>
                <NavLink to="/admin/products" className={navLinkClassName}>
                  Admin · Products
                </NavLink>
                <NavLink to="/admin/orders" className={navLinkClassName}>
                  Admin · Orders
                </NavLink>
              </>
            )}
          </nav>

          <span className="ml-auto hidden items-center gap-3 md:flex">
            {customerBadge}
            {user ? (
              <>
                <span className="text-sm font-semibold text-ink/70">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-primary hover:text-primary"
                >
                  Logout
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
              >
                Log in
              </NavLink>
            )}
          </span>

          {/* Mobile-only: cart stays reachable in one tap without opening the
              menu, since it's the one action a shopper needs most often. */}
          <NavLink
            to="/cart"
            onClick={closeMenu}
            aria-label={`Cart${totalItems > 0 ? `, ${totalItems} item${totalItems === 1 ? '' : 's'}` : ''}`}
            className="relative ml-auto grid size-10 place-items-center rounded-full text-ink/70 hover:bg-pink-light/60 md:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l3.6-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17M17 19a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM9 21a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
            </svg>
            {totalItems > 0 && (
              <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
                {totalItems}
              </span>
            )}
          </NavLink>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="grid size-10 place-items-center rounded-full text-ink/70 hover:bg-pink-light/60 md:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav id="mobile-menu" className="mx-auto flex max-w-7xl flex-col gap-1 border-t border-[var(--border)] px-4 py-3 md:hidden">
            <NavLink to="/products" className={mobileNavLinkClassName} onClick={closeMenu}>
              Products
            </NavLink>
            {user?.role === 'admin' && (
              <>
                <NavLink to="/admin/products" className={mobileNavLinkClassName} onClick={closeMenu}>
                  Admin · Products
                </NavLink>
                <NavLink to="/admin/orders" className={mobileNavLinkClassName} onClick={closeMenu}>
                  Admin · Orders
                </NavLink>
              </>
            )}

            <div className="my-2 border-t border-[var(--border)]" />

            <div className="flex items-center justify-between px-3 py-1">
              {customerBadge}
            </div>

            {user ? (
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-semibold text-ink/70">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-primary hover:text-primary"
                >
                  Logout
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                onClick={closeMenu}
                className="mx-3 mt-1 rounded-full bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
              >
                Log in
              </NavLink>
            )}
          </nav>
        )}
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>
      <Footer />
    </>
  )
}

export default Layout
