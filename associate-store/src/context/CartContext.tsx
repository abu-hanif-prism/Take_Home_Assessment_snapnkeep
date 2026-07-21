import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { Product } from '../lib/types'

export interface CartItem {
  product: Product
  quantity: number
}

type CartAction =
  | { type: 'ADD_ITEM'; product: Product; quantity: number }
  | { type: 'REMOVE_ITEM'; productId: string }
  | { type: 'UPDATE_QUANTITY'; productId: string; quantity: number }
  | { type: 'SYNC_ITEM'; product: Product }
  | { type: 'CLEAR_CART' }

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD_ITEM': {
      // Cap at available stock (product.quantity) — never let the cart hold
      // more of an item than the catalog actually has.
      const stock = action.product.quantity
      const existing = state.find((item) => item.product._id === action.product._id)
      const nextQuantity = Math.min((existing?.quantity ?? 0) + action.quantity, stock)

      if (nextQuantity <= 0) {
        // Out of stock — nothing to add, and if it was already in the cart
        // (stock dropped to 0 since it was added) this leaves it as-is
        // rather than silently removing something the user put there.
        return state
      }

      if (existing) {
        return state.map((item) => (item.product._id === action.product._id ? { ...item, quantity: nextQuantity } : item))
      }
      return [...state, { product: action.product, quantity: nextQuantity }]
    }

    case 'REMOVE_ITEM':
      return state.filter((item) => item.product._id !== action.productId)

    case 'UPDATE_QUANTITY': {
      const item = state.find((i) => i.product._id === action.productId)
      if (!item) return state

      const stock = item.product.quantity
      if (stock <= 0) {
        // No valid quantity in [1, stock] exists (item went out of stock
        // after being added) — leave it as-is; removal is a separate,
        // explicit action (removeFromCart), not an implicit side effect
        // of an unsatisfiable clamp.
        return state
      }

      // Clamp to [1, stock]: quantity never drops below 1 here (that's what
      // removeFromCart is for) and never exceeds available stock.
      const clamped = Math.min(Math.max(action.quantity, 1), stock)
      return state.map((i) => (i.product._id === action.productId ? { ...i, quantity: clamped } : i))
    }

    case 'SYNC_ITEM': {
      // Replace a stale cached product snapshot with fresh data from the
      // catalog (price, name, imageUrl, current stock, ...). If the new
      // stock is lower than what's in the cart, clamp down to it — same
      // "never exceed available stock" invariant as ADD_ITEM/UPDATE_QUANTITY.
      // If stock is now 0, leave the quantity as-is (don't silently drop
      // it) — the product still exists, it's just out of stock, and that's
      // surfaced by the updated product.quantity, not by mutating the cart.
      const stock = action.product.quantity
      return state.map((item) =>
        item.product._id === action.product._id
          ? { product: action.product, quantity: stock > 0 ? Math.min(item.quantity, stock) : item.quantity }
          : item,
      )
    }

    case 'CLEAR_CART':
      return []

    default:
      return state
  }
}

const CART_STORAGE_KEY = 'cart'

function loadInitialCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CartItem[]) : []
  } catch {
    return []
  }
}

interface CartContextValue {
  items: CartItem[]
  addToCart: (product: Product, quantity?: number) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  /**
   * Revalidate-on-load policy: re-fetches each cart item's live product data
   * against the catalog. A confirmed 404 (product deleted) removes the item;
   * any other error (network blip, 500, ...) leaves the cached snapshot
   * untouched rather than destroying user data over a transient failure.
   * Returns the names of items removed, so the caller can surface that.
   * Accepts an optional AbortSignal so a caller (useCheckout) can cancel the
   * in-flight requests if its own effect is torn down first.
   */
  syncWithCatalog: (signal?: AbortSignal) => Promise<{ removedNames: string[] }>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, [], loadInitialCart)

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addToCart = (product: Product, quantity = 1) => dispatch({ type: 'ADD_ITEM', product, quantity })
  const removeFromCart = (productId: string) => dispatch({ type: 'REMOVE_ITEM', productId })
  const updateQuantity = (productId: string, quantity: number) => dispatch({ type: 'UPDATE_QUANTITY', productId, quantity })
  const clearCart = () => dispatch({ type: 'CLEAR_CART' })

  const syncWithCatalog = async (signal?: AbortSignal): Promise<{ removedNames: string[] }> => {
    const removedNames: string[] = []

    await Promise.allSettled(
      items.map((item) =>
        apiFetch<Product>(`/api/products/${item.product._id}`, { signal })
          .then((product) => {
            if (signal?.aborted) return
            dispatch({ type: 'SYNC_ITEM', product })
          })
          .catch((err: unknown) => {
            if (signal?.aborted) return
            if (err instanceof ApiError && err.status === 404) {
              dispatch({ type: 'REMOVE_ITEM', productId: item.product._id })
              removedNames.push(item.product.name)
            }
            // Any other error (network blip, 500, an AbortError from the
            // signal firing mid-request, ...): leave the cached item as-is.
            // We couldn't confirm it's gone, so trust the cache rather than
            // destroy data over a transient failure.
          }),
      ),
    )

    return { removedNames }
  }

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, syncWithCatalog }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
