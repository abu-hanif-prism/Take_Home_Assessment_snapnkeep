import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import Toast from '../components/Toast'

interface ToastItem {
  id: number
  message: string
}

interface ToastContextValue {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 2000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const showToast = (message: string) => {
    idRef.current += 1
    setQueue((prev) => [...prev, { id: idRef.current, message }])
  }

  // Only the front of the queue (queue[0]) is ever on screen. Its timer
  // fires once and dequeues it — which makes the *next* item (if any) the
  // new front, and this effect picks that up because queue[0]?.id changed.
  //
  // Depending on queue[0]?.id rather than the whole `queue` array is the
  // load-bearing detail: appending a new toast to the back changes the
  // array reference but not the front item's identity, so it must NOT
  // reset the timer already counting down for whatever is currently
  // displayed. Depending on the whole array would restart the current
  // toast's countdown every time something new gets queued behind it.
  useEffect(() => {
    if (queue.length === 0) return

    const timeout = setTimeout(() => {
      setQueue((prev) => prev.slice(1))
    }, TOAST_DURATION_MS)

    return () => clearTimeout(timeout)
  }, [queue[0]?.id])

  const current = queue[0] ?? null

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast message={current?.message ?? null} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
