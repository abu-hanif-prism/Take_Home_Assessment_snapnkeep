interface RetryOptions {
  retries: number
  baseDelay: number
  // `delay` is the actual (jittered) wait in ms before the next attempt —
  // exposed so a caller can drive a progress indicator over that exact
  // duration, not just show static "retrying" text.
  onAttempt?: (attempt: number, error: unknown, delay: number) => void
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, { retries, baseDelay, onAttempt }: RetryOptions): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      if (attempt === retries) {
        // Out of attempts — surface the most recent failure to the caller.
        throw err
      }

      // Exponential ceiling: baseDelay * 2^attempt -> 500ms, 1s, 2s, 4s for
      // baseDelay=500. Full jitter: pick a random point in [0, ceiling]
      // rather than sleeping the ceiling itself. See explanation for why.
      const ceiling = baseDelay * 2 ** attempt
      const delay = Math.random() * ceiling

      onAttempt?.(attempt + 1, err, delay)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // Unreachable: every loop iteration either returns or throws. Kept so
  // TypeScript can see every path returns T or throws, without an unsound
  // non-null assertion after the loop.
  throw lastError
}
