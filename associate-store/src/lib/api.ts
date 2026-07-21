import { refreshTokens } from './auth'
import { clearTokens, getToken } from './tokenStore'

const API_URL = import.meta.env.VITE_API_URL
export const REFRESH_PATH = '/api/auth/refresh'
const LOGIN_PATH = '/api/auth/login'

// Shared by every in-flight apiFetch call so concurrent 401s trigger a single
// refresh instead of one each. See the comment on the 401 branch below for why.
let refreshPromise: Promise<void> | null = null

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// 401 interception flow
//
//   apiFetch(path) ──► fetch()
//                         │
//                         ▼
//                  status === 401,
//                  not already a retry,          ──── no ───► ok? ─ no ─► throw ApiError
//                  path !== /api/auth/refresh                  │
//                         │                                   yes
//                        yes                                   │
//                         ▼                                    ▼
//              refreshPromise already                      return JSON
//              in flight?
//                  │         │
//                 yes        no ──► start refreshTokens(),
//                  │              store it as refreshPromise
//                  └────────────┬──┘
//                                ▼
//                       await refreshPromise
//                        (every concurrent 401
//                         awaits this SAME promise)
//                         │        │
//                      succeeds  throws
//                         │        │
//                         ▼        ▼
//                   retry original   clearTokens()
//                   request once     redirect to /login
//                   (isRetry: true)  throw ApiError(401)
//                         │
//                         ▼
//                   (loops back to fetch() above, isRetry
//                    now true so a second 401 just falls
//                    through to the normal throw ApiError)
export async function apiFetch<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = getToken()

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  // LOGIN_PATH is excluded for the same reason REFRESH_PATH is: a 401 from
  // /api/auth/login means "wrong email/password" — there is no session yet
  // to refresh. Without this exclusion, a failed login attempt (correctly
  // rejected by the API) would fall into this branch, call refreshTokens()
  // with whatever refresh token happens to be in localStorage (often none),
  // get ITS OWN 401/400 back, and hard-navigate to /login via
  // window.location.href — reloading the page out from under the login
  // form before its `catch` block ever gets to show "invalid credentials".
  // Confirmed live: without this check, a wrong-password attempt fired a
  // second request to /api/auth/refresh and silently ate the error message.
  if (response.status === 401 && !isRetry && path !== REFRESH_PATH && path !== LOGIN_PATH) {
    // Refresh tokens are single-use (rotated on every /api/auth/refresh call).
    // If N requests 401 at once and each called refreshTokens() independently,
    // they'd all read the same not-yet-rotated refreshToken and all POST it.
    // The server only honors the first one; the rest arrive with a token that
    // was just invalidated by their sibling and get rejected as "invalid or
    // expired" — even though the session is perfectly valid. Those "failed"
    // refreshes would then clearTokens() and redirect to /login, logging the
    // user out from under a session that literally just succeeded. Sharing
    // one in-flight promise means every concurrent 401 awaits the SAME
    // refresh call and its single resulting rotation, instead of racing.
    refreshPromise ??= refreshTokens().finally(() => {
      refreshPromise = null
    })

    try {
      await refreshPromise
    } catch {
      clearTokens()
      window.location.href = '/login'
      throw new ApiError(401, 'Session expired')
    }

    return apiFetch<T>(path, options, true)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(response.status, body?.message ?? response.statusText)
  }

  return response.json() as Promise<T>
}
