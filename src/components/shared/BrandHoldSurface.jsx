import { useFutureImprovements } from '@/context/FutureImprovementsContext'
import { useLogoHoldUnlock } from '@/hooks/useLogoHoldUnlock'

/**
 * Wraps auth / custom brand blocks with the same 5s logo hold → future roadmap unlock.
 */
export default function BrandHoldSurface({ children, className = '', as: Tag = 'div' }) {
  const { openPanel } = useFutureImprovements()
  const { holding, progress, holdHandlers } = useLogoHoldUnlock(openPanel)

  return (
    <Tag
      className={`es-brand-hold-surface${holding ? ' es-brand-logo--holding' : ''} ${className}`.trim()}
      style={holding ? { '--hold-pct': progress } : undefined}
      {...holdHandlers}
    >
      <span className="es-brand-hold-ring" aria-hidden="true" />
      {children}
    </Tag>
  )
}
