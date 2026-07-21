export interface Product {
  _id: string
  name: string
  price: number
  quantity: number
  imageUrl: string
  /**
   * Not present in the live API response (verified against GET /api/products).
   * Included as optional to support the brief's product-description display requirement.
   */
  description?: string
  createdAt: string
  updatedAt: string
}

export interface PaginatedProducts {
  products: Product[]
  page: number
  limit: number
  totalPages: number
  totalProducts: number
}

export interface OrderItem {
  product: string
  quantity: number
}

// What the client sends to create an order — no _id/timestamps exist yet.
export interface OrderInput {
  products: OrderItem[]
  name: string
  email: string
  phone: string
  address: string
  recurring_customer: boolean
}

// What the API returns once the order has been persisted.
export interface Order extends OrderInput {
  _id: string
  createdAt: string
  updatedAt: string
}

export interface User {
  _id: string
  name: string
  email: string
  role: string
}

export interface LoginResponse extends User {
  token: string
  refreshToken: string
}
