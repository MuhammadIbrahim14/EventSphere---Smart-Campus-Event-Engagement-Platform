import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  Lock,
  Rocket,
  Shield,
  Sparkles,
  X,
} from 'lucide-react'
import { FUTURE_IMPROVEMENT_PHASES } from '@/constants/futureImprovements'
import { EsBrandMark } from '@/components/design-system/EsBrandLogo'

export default function FutureImprovementsPanel({ onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className="es-future"
      role="dialog"
      aria-modal="true"
      aria-labelledby="es-future-title"
      data-testid="future-improvements-panel"
    >
      <button
        type="button"
        className="es-future__backdrop"
        aria-label="Close roadmap"
        onClick={onClose}
      />

      <div className="es-future__panel surface">
        <div className="es-future__glow es-future__glow--a" aria-hidden="true" />
        <div className="es-future__glow es-future__glow--b" aria-hidden="true" />

        <header className="es-future__head">
          <div className="es-future__head-brand">
            <span className="es-future__mark" aria-hidden="true">
              <EsBrandMark cycle={0} />
            </span>
            <div>
              <p className="es-future__eyebrow">
                <Lock size={12} strokeWidth={2} />
                Internal roadmap · hidden access
              </p>
              <h1 id="es-future-title" className="es-future__title">
                Future improvements
              </h1>
              <p className="es-future__lead">
                Campus enrollment provisioning is shipping. Remaining items are roadmap —
                security-first scale, deeper integrations, and multi-institution path.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-quiet es-future__close"
            onClick={onClose}
            aria-label="Close"
            data-testid="button-close-future-improvements"
          >
            <X size={18} />
          </button>
        </header>

        <div className="es-future__stats">
          <div className="es-future__stat">
            <Rocket size={16} />
            <span>
              <strong>{FUTURE_IMPROVEMENT_PHASES.reduce((n, p) => n + p.items.length, 0)}</strong>
              planned features
            </span>
          </div>
          <div className="es-future__stat">
            <Shield size={16} />
            <span>
              <strong>Phase 1</strong> closed-campus security
            </span>
          </div>
          <div className="es-future__stat">
            <Sparkles size={16} />
            <span>
              <strong>SYNVEX FORGE</strong> · EventSphere SCEEP
            </span>
          </div>
        </div>

        <div className="es-future__grid">
          {FUTURE_IMPROVEMENT_PHASES.map((phase) => (
            <section
              key={phase.id}
              className="es-future__phase"
              style={{ '--phase-accent': phase.accent }}
            >
              <h2 className="es-future__phase-label">{phase.label}</h2>
              <ul className="es-future__list">
                {phase.items.map((item) => (
                  <li key={item.title} className="es-future__card">
                    <div className="es-future__card-top">
                      <h3>{item.title}</h3>
                      <ArrowRight size={14} className="es-future__card-arrow" aria-hidden="true" />
                    </div>
                    <p>{item.summary}</p>
                    <div className="es-future__tags">
                      {(Array.isArray(item.tags) ? item.tags : [item.tags]).map((tag) => (
                        <span key={tag} className="es-future__tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="es-future__foot">
          <p>
            This panel is not linked in navigation and has no public URL. Hold the EventSphere
            logo for 5 seconds to open — for roadmap review only.
          </p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Back to EventSphere
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
