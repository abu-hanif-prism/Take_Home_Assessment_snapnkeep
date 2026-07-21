import { useState } from 'react'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Reserved for the error message once submit logic is wired up.
  const [error] = useState('')

  return (
    <div className="mx-auto max-w-sm px-6 py-12">
      <h1>Login</h1>

      <form className="flex flex-col gap-4 text-left">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
          Log in
        </button>
      </form>
    </div>
  )
}

export default Login
