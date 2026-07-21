import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-cream">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 text-left sm:flex-row sm:justify-between lg:px-8">
        <div className="max-w-xs">
          <Link to="/products" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-primary font-heading text-sm font-bold text-white">
              A
            </span>
            <span className="font-heading text-base font-bold text-ink">Associate Store</span>
          </Link>
          <p className="mt-3 text-sm text-[var(--text)]">
            Quality products, picked and stocked for you. Free shipping on every order over $50.
          </p>
        </div>

        <div className="flex gap-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Shop</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-[var(--text)]">
              <li>
                <Link to="/products" className="hover:text-primary">
                  Products
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-primary">
                  Cart
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Account</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-[var(--text)]">
              <li>
                <Link to="/login" className="hover:text-primary">
                  Log in
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-6 py-4 text-center text-xs text-[var(--text)]">
        © {new Date().getFullYear()} Associate Store. Built as a take-home assignment.
      </div>
    </footer>
  )
}

export default Footer
