const FALLBACK_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"%3E%3Crect width="600" height="600" fill="%23f4f3ec"/%3E%3Ctext x="50%25" y="50%25" font-family="sans-serif" font-size="28" fill="%236b6375" text-anchor="middle" dominant-baseline="middle"%3EImage unavailable%3C/text%3E%3C/svg%3E'

interface ProductImageProps {
  src: string
  alt: string
  className?: string
}

function ProductImage({ src, alt, className }: ProductImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = FALLBACK_IMAGE
      }}
    />
  )
}

export default ProductImage
