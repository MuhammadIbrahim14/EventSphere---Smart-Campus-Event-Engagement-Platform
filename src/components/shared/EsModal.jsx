/**
 * Viewport-centered modal — always portals to document.body so fixed
 * positioning ignores workspace scroll / transform ancestors.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function EsModal({
  title,
  children,
  onClose,
  closeOnBackdrop = true,
  closeOnEscape = true,
  labelledBy = 'es-modal-title',
  className = '',
  panelClassName = '',
  testId,
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (!closeOnEscape || !onClose) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeOnEscape, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`modal-backdrop ${className}`.trim()}
      role="presentation"
      data-testid={testId || 'modal-backdrop'}
      onMouseDown={(e) => {
        if (closeOnBackdrop && onClose && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`modal ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? labelledBy : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="modal-head">
            {title ? <h2 id={labelledBy}>{title}</h2> : <span />}
            {onClose ? (
              <button
                className="icon-btn"
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                data-testid="button-close-modal"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
