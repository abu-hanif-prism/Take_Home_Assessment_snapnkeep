interface PaginationProps {
  page: number
  totalPages?: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

function Pagination({ page, totalPages, onPageChange, disabled = false }: PaginationProps) {
  return (
    <div className="mt-8 flex items-center justify-center gap-4">
      <button onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1} className="btn btn-outline">
        Previous
      </button>
      <span className="rounded-full bg-pink-light px-4 py-1.5 text-sm font-semibold text-primary">
        Page {page}
        {totalPages !== undefined ? ` of ${totalPages}` : ''}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || (totalPages !== undefined && page >= totalPages)}
        className="btn btn-outline"
      >
        Next
      </button>
    </div>
  )
}

export default Pagination
