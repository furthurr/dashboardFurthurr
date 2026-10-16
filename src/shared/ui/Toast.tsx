import { useEffect, useState } from 'react'

interface ToastProps {
  notice: { message: string } | null
  onClose: () => void
  label?: string
}

export function Toast({ notice, onClose, label = 'Notificación' }: ToastProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!notice || hovered || focused) return
    const timer = window.setTimeout(onClose, 4000)
    return () => window.clearTimeout(timer)
  }, [notice, onClose, hovered, focused])

  return (
    <div className="ui-toast-region">
      <div role="status" aria-label={label} aria-atomic="true">
        {notice && <div className="ui-feedback ui-feedback--success ui-toast"
          onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
          }}>
          <span className="min-w-0 flex-1">{notice.message}</span>
          <button type="button" className="ui-toast-close" aria-label="Cerrar notificación" onClick={() => {
            setHovered(false)
            setFocused(false)
            onClose()
          }}>
            <svg aria-hidden="true" className="ui-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>}
      </div>
    </div>
  )
}
