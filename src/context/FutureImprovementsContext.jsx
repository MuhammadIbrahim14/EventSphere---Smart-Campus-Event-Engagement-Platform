import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import FutureImprovementsPanel from '@/components/shared/FutureImprovementsPanel'

const FutureImprovementsContext = createContext(null)

export function FutureImprovementsProvider({ children }) {
  const [open, setOpen] = useState(false)

  const openPanel = useCallback(() => setOpen(true), [])
  const closePanel = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ openPanel, closePanel, isOpen: open }),
    [openPanel, closePanel, open],
  )

  return (
    <FutureImprovementsContext.Provider value={value}>
      {children}
      {open ? <FutureImprovementsPanel onClose={closePanel} /> : null}
    </FutureImprovementsContext.Provider>
  )
}

export function useFutureImprovements() {
  const ctx = useContext(FutureImprovementsContext)
  if (!ctx) {
    return {
      openPanel: () => {},
      closePanel: () => {},
      isOpen: false,
    }
  }
  return ctx
}
