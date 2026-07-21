import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  title: string
  onClose: () => void
  // While true, Escape/backdrop-click/the close button are all no-ops and
  // the close button reads as disabled — used while a form inside is
  // mid-submit, so closing can't unmount it out from under an in-flight
  // request (same "don't orphan a submitting form" rule Edit already
  // enforces on the table beneath this modal).
  closeDisabled?: boolean
  children: ReactNode
}

function Modal({ title, onClose, closeDisabled, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  const requestClose = () => {
    if (closeDisabled) return
    onClose()
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKeyDown)

    // Lock background scroll while the modal is open, restore on close.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog so keyboard/screen-reader users land
    // somewhere sensible instead of it opening silently behind them.
    dialogRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeDisabled])

  // Portalled to document.body: this component can be mounted anywhere in
  // the tree (here, inside a table's own section of the page), and a
  // `position: fixed` element still floats correctly without a portal in
  // THIS app's CSS — but portalling is what guarantees that stays true no
  // matter what a future ancestor adds (a transform, a filter, anything
  // that creates a new containing block and would otherwise trap it).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-16 sm:pt-24">
      <div aria-hidden="true" className="fixed inset-0 bg-ink/40 backdrop-blur-sm" onClick={requestClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="card animate-modal-in relative w-full max-w-lg p-6 outline-none"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="!mb-0">
            {title}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            disabled={closeDisabled}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-full text-lg text-ink/60 transition-colors hover:bg-pink-light hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
