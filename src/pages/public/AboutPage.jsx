import { useEffect, useState } from 'react'
import { Sparkles, Users, ShieldCheck } from 'lucide-react'
import PublicShell from './PublicShell'
import { getAboutContent, DEFAULT_ABOUT } from '@/services/siteContent'
import '@/styles/eventsphere-site-content.css'

const HIGHLIGHT_ICONS = [Users, Sparkles, ShieldCheck]

export default function AboutPage() {
  const [about, setAbout] = useState(DEFAULT_ABOUT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await getAboutContent()
      if (alive && data) setAbout(data)
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  const paragraphs = String(about.body || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const highlights = Array.isArray(about.highlights) ? about.highlights.filter((h) => h.title || h.body) : []

  return (
    <PublicShell eyebrow={about.eyebrow} title={about.title}>
      <div className="es-about" data-testid="about-page">
        {loading ? <p className="muted">Loading campus story…</p> : null}

        <section className="surface es-about__hero">
          <div className="eyebrow">Campus story</div>
          <p className="es-about__lead">{about.lead}</p>
          {paragraphs.map((p) => (
            <p key={p.slice(0, 48)} className="es-about__body">
              {p}
            </p>
          ))}
        </section>

        {highlights.length > 0 ? (
          <div className="es-about__grid">
            {highlights.map((h, i) => {
              const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length]
              return (
                <article key={`${h.title}-${i}`} className="surface es-about__card">
                  <div className="es-about__card-icon" aria-hidden>
                    <Icon size={18} />
                  </div>
                  <h3 className="display">{h.title}</h3>
                  <p className="muted">{h.body}</p>
                </article>
              )
            })}
          </div>
        ) : null}
      </div>
    </PublicShell>
  )
}
