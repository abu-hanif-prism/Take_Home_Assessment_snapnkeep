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

// What the client sends to create a product — no _id/timestamps exist yet.
export interface NewProductInput {
  name: string
  price: number
  quantity: number
  imageUrl: string
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

export interface PopulatedOrderItem {
  product: Product
  quantity: number
}

// GET /api/orders (the admin list) returns a DIFFERENT shape for `products`
// than POST /api/orders' response or `Order` above — confirmed live: this
// endpoint populates the full Product for each line item, while creating
// an order only ever echoes back the product id string. Modeled as its own
// type rather than reusing Order, since the two aren't interchangeable.
export interface AdminOrder {
  _id: string
  products: PopulatedOrderItem[]
  name: string
  email: string
  phone: string
  address: string
  recurring_customer: boolean
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
