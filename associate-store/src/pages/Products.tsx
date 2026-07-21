import { apiFetch } from '../lib/api'
import type { PaginatedProducts } from '../lib/types'

function Products() {
  // TEMPORARY: manual apiFetch smoke test, remove once real product fetching lands.
  const testFetch = async () => {
    const result = await apiFetch<PaginatedProducts>('/api/products?page=1&limit=20')
    console.log(result)
  }

  return (
    <div>
      <h1>Products</h1>
      <button onClick={testFetch}>Test apiFetch</button>
    </div>
  )
}

export default Products
