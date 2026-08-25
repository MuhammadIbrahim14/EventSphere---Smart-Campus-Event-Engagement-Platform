import PublicShell from './PublicShell'

const FAQS = [
  {
    q: 'Who can create events?',
    a: 'Organizers assigned by an admin. New signups always start as students (user role).',
  },
  {
    q: 'How do registrations work?',
    a: 'Students register for approved events. If the room is full, you may be waitlisted. Cancelling can promote the next waitlisted person.',
  },
  {
    q: 'What is the QR pass for?',
    a: 'After you register, My Passes shows a QR code. Organizers scan or paste it to mark attendance.',
  },
  {
    q: 'Are payments required for certificates?',
    a: 'EventSphere only records a fee acknowledgment — there is no payment gateway in this build.',
  },
  {
    q: 'Can guests browse without signing in?',
    a: 'Yes. About, Contact, FAQs, Sitemap, and the Media Gallery are public. Registration needs an account.',
  },
]

export default function FaqPage() {
  return (
    <PublicShell eyebrow="Answers" title="FAQs">
      <div style={{ display: 'grid', gap: 12 }}>
        {FAQS.map((item) => (
          <div className="surface" style={{ padding: 20 }} key={item.q}>
            <h3 className="display" style={{ margin: '0 0 8px', fontSize: 18 }}>
              {item.q}
            </h3>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </PublicShell>
  )
}
