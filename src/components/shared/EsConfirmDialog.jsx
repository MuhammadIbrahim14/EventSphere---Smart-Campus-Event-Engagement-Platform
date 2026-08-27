/**
 * Themed confirm / notice dialog — replaces window.confirm / alert.
 * Matches EventSphere modal chrome (EsModal).
 */
import EsModal from '@/components/shared/EsModal'

export default function EsConfirmDialog({
  open = true,
  title = 'Please confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default', // default | danger | success
  busy = false,
  hideCancel = false,
  onConfirm,
  onCancel,
  testId = 'es-confirm-dialog',
}) {
  if (!open) return null

  const primaryClass =
    tone === 'danger' ? 'btn btn-danger' : tone === 'success' ? 'btn btn-primary' : 'btn btn-primary'

  return (
    <EsModal
      title={title}
      onClose={busy ? undefined : onCancel}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      labelledBy="es-confirm-title"
      panelClassName="es-confirm-dialog"
      testId={testId}
    >
      {message ? (
        <p className="es-confirm-dialog__message" id="es-confirm-desc">
          {message}
        </p>
      ) : null}
      <div className="es-confirm-dialog__actions">
        {!hideCancel ? (
          <button className="btn" type="button" disabled={busy} onClick={onCancel} data-testid="button-confirm-cancel">
            {cancelLabel}
          </button>
        ) : null}
        <button
          className={primaryClass}
          type="button"
          disabled={busy}
          onClick={onConfirm}
          data-testid="button-confirm-ok"
        >
          {busy ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </EsModal>
  )
}
