import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  busy?: boolean
  className?: string
  onPaste?: React.ClipboardEventHandler<HTMLDivElement>
}

const focusableSelector = 'a[href], button, input:not([type="hidden"]), textarea, select, [tabindex]'

function focusableElements(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    const style = getComputedStyle(element)
    return element.tabIndex >= 0 && !element.matches(':disabled') &&
      !element.closest('[hidden], [inert]') && style.display !== 'none' && style.visibility !== 'hidden'
  })
}

// Mount only while open; the consumer owns the dialog-body and dialog-footer children.
export function Dialog({ title, subtitle, onClose, children, busy = false, className = '', onPaste }: DialogProps) {
  const titleId = useId()
  const subtitleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeFromKeyboard = useEffectEvent(() => {
    if (!busy) onClose()
  })

  useEffect(() => {
    const panel = panelRef.current!
    const origin = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const elements = focusableElements(panel)
    const initial = elements.find((element) => element.matches('input, textarea')) ??
      elements.find((element) => element.matches('button')) ?? panel
    initial.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeFromKeyboard()
      }
      if (event.key !== 'Tab') return
      const elements = focusableElements(panel)
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (!first) {
        event.preventDefault()
        panel.focus()
      } else if (!panel.contains(document.activeElement) || document.activeElement === panel ||
        (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
      }
    }

    function containFocus(event: FocusEvent) {
      if (event.target instanceof Node && !panel.contains(event.target)) {
        const target = focusableElements(panel)[0] ?? panel
        target.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', containFocus)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', containFocus)
      document.body.style.overflow = previousOverflow
      if (origin instanceof HTMLElement && origin.isConnected) origin.focus()
    }
  }, [])

  const requestClose = () => { if (!busy) onClose() }

  return (
    <div className="dialog-backdrop" onClick={(event) => {
      if (event.target === event.currentTarget) requestClose()
    }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        aria-busy={busy} tabIndex={-1} className={`dialog-panel ${className}`} onPaste={onPaste}>
        <header className="dialog-header">
          <div className="min-w-0 flex-1">
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p id={subtitleId} className="mt-1 text-sm font-normal text-[var(--color-text-muted)] [overflow-wrap:anywhere]">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Cerrar diálogo" disabled={busy} onClick={requestClose}
            className="ui-button ui-button--secondary shrink-0 px-2">
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
