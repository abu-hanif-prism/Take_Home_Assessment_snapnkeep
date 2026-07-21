import { createContext, useContext, useState, type ReactNode } from 'react'

interface CustomerStatus {
  hasOrdered: boolean
  firstOrderDate: string
}

const CUSTOMER_STATUS_KEY = 'customerStatus'

function readCustomerStatus(): CustomerStatus | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_STATUS_KEY)
    return raw ? (JSON.parse(raw) as CustomerStatus) : null
  } catch {
    return null
  }
}

interface CustomerContextValue {
  isReturningCustomer: boolean
  markAsReturningCustomer: () => void
}

const CustomerContext = createContext<CustomerContextValue | null>(null)

// Promoted from a plain hook to a Context: the navbar badge (Layout, which
// persists across every route change) and useCheckout (which mounts fresh
// each time /cart is opened) both need to read this flag, and one of them
// needs to WRITE it. Two independent useState instances backed by the same
// localStorage key would drift — placing an order would update Cart's own
// copy immediately but leave the still-mounted navbar badge showing "New
// Customer" until a hard refresh. A shared Provider means both read the
// same state, so a write from one is immediately visible in the other.
export function CustomerProvider({ children }: { children: ReactNode }) {
  const [isReturningCustomer, setIsReturningCustomer] = useState(() => readCustomerStatus()?.hasOrdered ?? false)

  const markAsReturningCustomer = () => {
    // Only set firstOrderDate once — a second or third successful order
    // must not overwrite the original date with a later one.
    if (readCustomerStatus()?.hasOrdered) {
      setIsReturningCustomer(true)
      return
    }

    const status: CustomerStatus = { hasOrdered: true, firstOrderDate: new Date().toISOString() }
    localStorage.setItem(CUSTOMER_STATUS_KEY, JSON.stringify(status))
    setIsReturningCustomer(true)
  }

  return (
    <CustomerContext.Provider value={{ isReturningCustomer, markAsReturningCustomer }}>
      {children}
    </CustomerContext.Provider>
  )
}

export function useReturningCustomer(): CustomerContextValue {
  const context = useContext(CustomerContext)
  if (!context) {
    throw new Error('useReturningCustomer must be used within a CustomerProvider')
  }
  return context
}
