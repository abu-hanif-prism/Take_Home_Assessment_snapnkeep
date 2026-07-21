import { NavLink, Outlet } from 'react-router-dom'

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-semibold text-blue-600' : 'text-gray-600'

function Layout() {
  return (
    <>
      <nav className="flex gap-6 border-b border-gray-200 px-6 py-4">
        <NavLink to="/products" className={navLinkClassName}>
          Products
        </NavLink>
        <NavLink to="/cart" className={navLinkClassName}>
          Cart
        </NavLink>
        <NavLink to="/login" className={navLinkClassName}>
          Login
        </NavLink>
      </nav>
      <Outlet />
    </>
  )
}

export default Layout
