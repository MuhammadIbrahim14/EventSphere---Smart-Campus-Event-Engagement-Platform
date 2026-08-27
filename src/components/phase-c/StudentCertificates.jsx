import { useEffect, useState } from 'react'
import { Check, Download, Printer } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { downloadCertificate, printCertificate } from '@/lib/certificateGenerate'
import {
  acknowledgeCertificateFee,
  listCertificatesForStudent,
} from '@/services/certificates'
import EsModal from '@/components/shared/EsModal'

export default function StudentCertificates({ setToast }) {
  const { user, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [feeForm, setFeeForm] = useState({ eventId: null, feeAmount: '', feeDetails: '' })

  async function load() {
    if (!user?.id) return
    setLoading(true)
    const { data, error } = await listCertificatesForStudent(user.id)
    if (error) setToast?.(error.message)
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function ackFee() {
    const { error } = await acknowledgeCertificateFee({
      eventId: feeForm.eventId,
      studentId: user.id,
      feeAmount: feeForm.feeAmount ? Number(feeForm.feeAmount) : null,
      feeDetails: feeForm.feeDetails,
    })
    if (error) {
      setToast?.(error.message)
      return
    }
    setToast?.('Fee acknowledged (no payment taken)')
    setFeeForm({ eventId: null, feeAmount: '', feeDetails: '' })
    load()
  }

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
    // Prefer external file if organizer pasted a real http(s) URL
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

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Credentials</div>
          <h1>Certificates</h1>
          <p>
            After the organizer issues your certificate, download a generated certificate (PNG) or print/Save as PDF.
            No payment gateway — fee acknowledgment only.
          </p>
        </div>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && !rows.length && (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>
            No certificates yet. Attend the event, wait until it ends, then the organizer issues certificates.
          </p>
        </div>
      )}

      <div className="grid-2">
        {rows.map((c) => (
          <div className="surface" style={{ padding: 20 }} key={c.id}>
            <div className="eyebrow">{c.issued_on ? 'Issued' : 'Pending issue'}</div>
            <h3 className="display" style={{ margin: '10px 0 6px', fontSize: 20 }}>
              {c.events?.title || 'Event'}
            </h3>
            <p className="muted" style={{ fontSize: 12 }}>
              {c.fee_acknowledged ? 'Fee acknowledged' : 'Fee not acknowledged'}
              {c.fee_amount != null ? ` · ${c.fee_amount}` : ''}
            </p>
            <div className="event-actions" style={{ marginTop: 14 }}>
              {c.issued_on ? (
                <>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => onDownload(c)}
                    data-testid={`button-download-cert-${c.id}`}
                  >
                    <Download size={14} /> {busyId === c.id ? 'Generating…' : 'Download certificate'}
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
              {!c.fee_acknowledged && (
                <button
                  className="btn"
                  type="button"
                  onClick={() =>
                    setFeeForm({
                      eventId: c.event_id,
                      feeAmount: c.fee_amount != null ? String(c.fee_amount) : '',
                      feeDetails: c.fee_details || '',
                    })
                  }
                >
                  Acknowledge fee
                </button>
              )}
              {c.fee_acknowledged && (
                <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Check size={14} /> Acknowledged
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {feeForm.eventId && (
        <EsModal
          title="Certificate fee acknowledgment"
          onClose={() => setFeeForm({ eventId: null, feeAmount: '', feeDetails: '' })}
        >
            <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
              This records acknowledgment only — EventSphere does not process payments.
            </p>
            <div className="form-grid">
              <div>
                <label className="label">Amount (optional)</label>
                <input
                  className="input"
                  type="number"
                  value={feeForm.feeAmount}
                  onChange={(e) => setFeeForm({ ...feeForm, feeAmount: e.target.value })}
                />
              </div>
              <div className="full">
                <label className="label">Details</label>
                <textarea
                  className="input"
                  rows={3}
                  value={feeForm.feeDetails}
                  onChange={(e) => setFeeForm({ ...feeForm, feeDetails: e.target.value })}
                  placeholder="e.g. Paid at campus office / waived"
                />
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} type="button" onClick={ackFee}>
              I acknowledge
            </button>
        </EsModal>
      )}
    </>
  )
}
