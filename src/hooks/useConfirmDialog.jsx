import { useCallback, useRef, useState } from 'react'
import EsConfirmDialog from '@/components/shared/EsConfirmDialog'

export function useConfirmDialog() {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)

  const close = useCallback((value) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setState(null)
    if (resolve) resolve(value)
  }, [])

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setState({
        title: options.title || 'Please confirm',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        tone: options.tone || 'default',
        hideCancel: Boolean(options.hideCancel),
      })
    })
  }, [])

  const alert = useCallback(
    (options = {}) => {
      return confirm({
        title: options.title || 'Notice',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'OK',
        hideCancel: true,
        tone: options.tone || 'default',
      })
    },
    [confirm],
  )

  const dialog = state ? (
    <EsConfirmDialog
      open
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      tone={state.tone}
      hideCancel={state.hideCancel}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null

  return { confirm, alert, dialog }
}
