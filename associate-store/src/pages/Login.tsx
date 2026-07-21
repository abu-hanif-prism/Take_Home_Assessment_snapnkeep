import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  // Same synchronous double-submit guard used by useCheckout/ProductForm —
  // disabled={submitting} alone leaves a window between the click and the
  // next render where a fast second Enter/click can re-enter this handler.
  const submittingRef = useRef(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)

    try {
      await login(email, password)
      navigate('/products')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to log in. Please try again.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden="true"
        className="hero-blob pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-pink opacity-30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="hero-blob pointer-events-none absolute -right-16 bottom-0 size-64 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="card relative w-full max-w-sm p-8 text-left">
        <span className="grid size-11 place-items-center rounded-full bg-primary font-heading text-lg font-bold text-white shadow-sm">
          A
        </span>
        <h1 className="mt-5 !text-3xl">Welcome back</h1>
        <p className="mb-6 text-sm text-[var(--text)]">Log in to manage your orders.</p>

        <form className="flex flex-col gap-4 text-left" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-[var(--text)]">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="rounded-xl border border-[var(--border)] px-3.5 py-2.5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-gray-100"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-[var(--text)]">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="rounded-xl border border-[var(--border)] px-3.5 py-2.5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-gray-100"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
