import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-semibold text-blue-600' : 'text-gray-600'

function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/products')
  }

  return (
    <>
      <nav className="flex gap-6 border-b border-gray-200 px-6 py-4">
        <NavLink to="/products" className={navLinkClassName}>
          Products
        </NavLink>
        <NavLink to="/cart" className={navLinkClassName}>
          Cart
        </NavLink>
        <span className="ml-auto flex items-center gap-4">
          {user ? (
            <>
              <span className="text-gray-600">{user.name}</span>
              <button onClick={handleLogout} className="text-gray-600">
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/login" className={navLinkClassName}>
              Log in
            </NavLink>
          )}
        </span>
      </nav>
      <Outlet />
    </>
  )
}

export default Layout
