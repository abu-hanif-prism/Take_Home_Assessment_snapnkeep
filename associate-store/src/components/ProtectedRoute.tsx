import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  requireAdmin?: boolean
}

function ProtectedRoute({ children, requireAdmin }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  // Wait for the /api/auth/me check to settle before deciding — otherwise a
  // logged-in user with a valid token gets bounced to /login for the instant
  // between mount and that request resolving.
  if (loading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && user.role !== 'admin') {
    return <p>Admins only</p>
  }

  return children
}

export default ProtectedRoute
