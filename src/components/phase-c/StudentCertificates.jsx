import { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { downloadCertificate, printCertificate } from '@/lib/certificateGenerate'
import { listCertificatesForStudent } from '@/services/certificates'
import { isPublicGuestRole } from '@/constants/roles'

export default function StudentCertificates({ setToast }) {
  const { user, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  async function load() {
    if (!user?.id) return
    if (isPublicGuestRole(profile?.role)) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await listCertificatesForStudent(user.id)
    if (error) setToast?.(error.message)
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role])

  function certPayload(c) {
    return {
      studentName: profile?.full_name || user?.email || 'Participant',
      eventTitle: c.events?.title || 'Campus Event',
      eventDate: c.events?.event_date || null,
      issuedOn: c.issued_on,
      organizerLabel: 'EventSphere',
    }
  }

  async function onDownload(c) {
    const url = String(c.certificate_url || '')
    if (/^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    setBusyId(c.id)
    try {
      await downloadCertificate(certPayload(c))
      setToast?.('Certificate PNG downloaded')
    } catch (err) {
      setToast?.(err?.message || 'Could not generate certificate')
    }
    setBusyId('')
  }

  function onPrint(c) {
    const { error } = printCertificate(certPayload(c))
    if (error) setToast?.(error.message)
  }

  if (isPublicGuestRole(profile?.role)) {
    return (
      <div className="surface" style={{ padding: 24 }}>
        <p className="muted" style={{ margin: 0 }}>
          Certificates are for campus students only. Public guests keep QR passes in the Guest Hub.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Your credentials</div>
          <h1>Certificates</h1>
          <p>Issued after the organizer marks you Present — download PNG or print / Save as PDF.</p>
        </div>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && !rows.length && (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>
            No certificates yet. Attend the event, wait until it ends, then the organizer issues them.
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="grid-2 stagger">
          {rows.map((c) => {
            const issued = Boolean(c.issued_on)
            const title = c.events?.title || 'Campus event'
            const date = c.events?.event_date ? String(c.events.event_date).slice(0, 10) : 'Date TBA'
            const name = profile?.full_name || user?.email || 'Student'
            return (
              <div className="surface pass" key={c.id} data-testid={`cert-card-${c.id}`}>
                <div className="pass-top">
                  <div className="eyebrow">
                    EventSphere · {issued ? 'Issued' : 'Pending'}
                  </div>
                  <h2 className="display" style={{ fontSize: 25, margin: '16px 0 6px' }}>
                    {title}
                  </h2>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {date}
                    {issued
                      ? ` · Issued ${new Date(c.issued_on).toLocaleDateString()}`
                      : ' · Awaiting organizer'}
                  </div>
                </div>
                <div className="pass-bottom">
                  <div>
                    <div className="subtle" style={{ fontSize: 9, letterSpacing: '.12em' }}>
                      STUDENT
                    </div>
                    <strong style={{ display: 'block', marginTop: 5 }}>{name}</strong>
                    <div className="subtle mono" style={{ marginTop: 16, fontSize: 10 }}>
                      CERT · ES-{String(c.event_id || c.id).slice(0, 4).toUpperCase()}
                    </div>
                  </div>
                  <div
                    className="muted"
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 12,
                      display: 'grid',
                      placeItems: 'center',
                      border: '1px solid var(--line)',
                      fontSize: 11,
                      textAlign: 'center',
                      padding: 8,
                      lineHeight: 1.35,
                    }}
                  >
                    {issued ? 'Ready to download' : 'Not issued yet'}
                  </div>
                </div>
                <div style={{ padding: '0 24px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {issued ? (
                    <>
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => onDownload(c)}
                        data-testid={`button-download-cert-${c.id}`}
                      >
                        <Download size={14} />{' '}
                        {busyId === c.id ? 'Generating…' : 'Download PNG'}
                      </button>
                      <button className="btn" type="button" onClick={() => onPrint(c)}>
                        <Printer size={14} /> Print / PDF
                      </button>
                    </>
                  ) : (
                    <button className="btn" type="button" disabled>
                      Awaiting issue
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
