const LOW_STOCK_THRESHOLD = 5

export interface StockStatus {
  text: string
  className: string
}

export function stockStatus(quantity: number): StockStatus {
  if (quantity === 0) {
    return { text: 'Out of stock', className: 'bg-red-50 text-red-600' }
  }
  if (quantity < LOW_STOCK_THRESHOLD) {
    return { text: `Only ${quantity} left`, className: 'bg-amber-50 text-amber-600' }
  }
  return { text: 'In stock', className: 'bg-green-50 text-green-700' }
}
