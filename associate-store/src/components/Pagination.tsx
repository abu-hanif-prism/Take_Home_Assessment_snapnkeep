interface PaginationProps {
  page: number
  totalPages?: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

function Pagination({ page, totalPages, onPageChange, disabled = false }: PaginationProps) {
  return (
    <div className="mt-6 flex items-center justify-center gap-4">
      <button onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1}>
        Previous
      </button>
      <span>
        Page {page}
        {totalPages !== undefined ? ` of ${totalPages}` : ''}
      </span>
      <button onClick={() => onPageChange(page + 1)} disabled={disabled || (totalPages !== undefined && page >= totalPages)}>
        Next
      </button>
    </div>
  )
}

export default Pagination
