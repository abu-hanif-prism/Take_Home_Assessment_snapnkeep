import { apiFetch, REFRESH_PATH } from './api'
import { getRefreshToken, setTokens } from './tokenStore'
import type { LoginResponse } from './types'

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  setTokens(response.token, response.refreshToken)

  return response
}

export async function refreshTokens(): Promise<void> {
  const refreshToken = getRefreshToken()

  const response = await apiFetch<Pick<LoginResponse, 'token' | 'refreshToken'>>(REFRESH_PATH, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })

  // The server rotates refresh tokens on every call: the one we just sent was
  // marked used/invalidated server-side the moment this request was processed,
  // so it can't be replayed. We must overwrite it with the new one below, or
  // the next refresh attempt will fail even though this one succeeded.
  setTokens(response.token, response.refreshToken)
}
