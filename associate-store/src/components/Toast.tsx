interface ToastProps {
  message: string | null
}

function Toast({ message }: ToastProps) {
  if (!message) {
    return null
  }

  return (
    <div
      role="status"
      className="toast-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
    >
      {message}
    </div>
  )
}

export default Toast
