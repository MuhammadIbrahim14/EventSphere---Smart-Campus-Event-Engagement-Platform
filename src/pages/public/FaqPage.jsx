import { useEffect, useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import PublicShell from './PublicShell'
import { listPublishedFaqs } from '@/services/siteContent'
import '@/styles/eventsphere-site-content.css'

const FALLBACK_FAQS = [
  {
    id: 'fb-1',
    question: 'Who can create events?',
    answer:
      'Organizers assigned by an admin. New signups always start as students (user role) until an admin promotes them.',
  },
  {
    id: 'fb-2',
    question: 'How do registrations work?',
    answer:
      'Students and public guests register for approved events. If the room is full, you may be waitlisted. Cancelling a seat can promote the next waitlisted person.',
  },
  {
    id: 'fb-3',
    question: 'What is the QR pass for?',
    answer:
      'After you register (and pay if required), My Passes shows a QR code. Organizers scan or paste it to mark attendance at the door.',
  },
  {
    id: 'fb-4',
    question: 'Who gets certificates?',
    answer:
      'Only campus students. After the event ends, organizers issue certificates to Present students. Public guests keep QR passes — not certificates.',
  },
  {
    id: 'fb-5',
    question: 'Can guests browse without signing in?',
    answer:
      'Yes. About, Contact, FAQs, Sitemap, Events browse, and the Media Gallery are public. Registration and passes need an account.',
  },
]

export default function FaqPage() {
  const [faqs, setFaqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error, fallback } = await listPublishedFaqs()
      if (!alive) return
      const rows = data?.length ? data : FALLBACK_FAQS
      setFaqs(rows)
      if (rows[0]) setOpenId(rows[0].id)
      if (error && !fallback) {
        /* keep fallback silent for public guests */
      }
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <PublicShell eyebrow="Answers" title="FAQs">
      <div className="es-faq" data-testid="faq-page">
        <div className="surface es-faq__intro">
          <HelpCircle size={18} aria-hidden />
          <p className="muted" style={{ margin: 0 }}>
            Quick answers about roles, registrations, passes, certificates, and payments. Campus admin can
            update these anytime.
          </p>
        </div>

        {loading ? <p className="muted">Loading FAQs…</p> : null}

        <div className="es-faq__list" role="list">
          {faqs.map((item) => {
            const open = String(openId) === String(item.id)
            return (
              <div className={`surface es-faq__item ${open ? 'is-open' : ''}`} key={item.id} role="listitem">
                <button
                  type="button"
                  className="es-faq__q"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.id)}
                  data-testid={`faq-toggle-${item.id}`}
                >
                  <span>{item.question}</span>
                  <ChevronDown size={18} className="es-faq__chev" aria-hidden />
                </button>
                {open ? (
                  <div className="es-faq__a">
                    <p className="muted">{item.answer}</p>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </PublicShell>
  )
}
