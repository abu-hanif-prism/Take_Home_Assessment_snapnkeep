import { Link, Outlet } from 'react-router-dom'

function Layout() {
  return (
    <>
      <nav className="flex gap-6 border-b border-gray-200 px-6 py-4">
        <Link to="/products">Products</Link>
        <Link to="/cart">Cart</Link>
        <Link to="/login">Login</Link>
      </nav>
      <Outlet />
    </>
  )
}

export default Layout
