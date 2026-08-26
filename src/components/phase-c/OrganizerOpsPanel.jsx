import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, Check, CheckCircle2, QrCode, Upload, UserCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ATTENDANCE_METHOD, REGISTRATION_STATUS, TABLES } from '@/constants/domain'
import { parseAttendancePayload } from '@/lib/qrPayload'
import {
  eventNotStartedMessage,
  formatEventSchedule,
  getEventPhase,
  isEventDayOrPast,
  isEventEnded,
} from '@/lib/eventDate'
import { listEventAttendance, markAttendance } from '@/services/attendance'
import { listEventRegistrations, updateRegistrationStatus } from '@/services/registrations'
import { processRegistrationPayment } from '@/services/payments'
import { issueCertificate, listCertificatesForEvent } from '@/services/certificates'
import { addMedia } from '@/services/media'
import { uploadEventMedia } from '@/services/storage'
import MediaModeration from '@/components/ops/MediaModeration'
import StationCheckinPoster from '@/components/ops/StationCheckinPoster'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'
import { attendanceMethodLabel } from '@/lib/stationCheckin'

function studentKey(row) {
  return row?.studentId || row?.student_id || row?.student?.id || ''
}

export default function OrganizerOpsPanel({ events, setToast }) {
  const { user } = useAuth()
  const mine = useMemo(() => {
    const list = events || []
    const owned = list.filter((e) => e.organizerId && user?.id && e.organizerId === user.id)
    return owned.length ? owned : list
  }, [events, user?.id])
  const [eventId, setEventId] = useState(mine[0]?.id || '')
  const [tab, setTab] = useState('attendance')
  const [regs, setRegs] = useState([])
  const [attendance, setAttendance] = useState([])
  const [qrText, setQrText] = useState('')
  const [busy, setBusy] = useState(false)
  const [markingId, setMarkingId] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [statusKind, setStatusKind] = useState('ok') // ok | err
  const [caption, setCaption] = useState('')
  const [certs, setCerts] = useState([])
  const [certUrl, setCertUrl] = useState('')
  const [mediaTick, setMediaTick] = useState(0)
  const [stationPosterOpen, setStationPosterOpen] = useState(false)

  useEffect(() => {
    if (!eventId && mine[0]?.id) setEventId(mine[0].id)
  }, [mine, eventId])

  const selectedEvent = mine.find((e) => String(e.id) === String(eventId))
  const attendanceUnlocked = isEventDayOrPast(selectedEvent?.date)
  const certsUnlocked = selectedEvent ? isEventEnded(selectedEvent) : false
  const phase = selectedEvent ? getEventPhase(selectedEvent) : 'unknown'

  function flash(message, kind = 'ok') {
    setStatusMsg(message)
    setStatusKind(kind)
    setToast?.(message)
  }

  const refresh = useCallback(async () => {
    if (!eventId) return
    const [r, a, c] = await Promise.all([
      listEventRegistrations(eventId),
      listEventAttendance(eventId),
      listCertificatesForEvent(eventId),
    ])
    // Silent on realtime ticks — avoid toast spam if a partial fetch fails
    if (!r.error) setRegs(r.data || [])
    if (!a.error) setAttendance(a.data || [])
    if (!c.error) setCerts(c.data || [])
  }, [eventId])

  useEffect(() => {
    setStatusMsg('')
    refresh()
  }, [eventId, refresh])

  useRealtimeTables(
    [TABLES.REGISTRATIONS, TABLES.ATTENDANCE, TABLES.CERTIFICATES, TABLES.MEDIA_GALLERY],
    refresh,
    { channelName: `es-org-ops-${eventId || 'none'}`, enabled: Boolean(eventId) },
  )

  async function markManual(studentId, label) {
    if (!eventId) {
      flash('Select an event first', 'err')
      return
    }
    if (!attendanceUnlocked) {
      flash(eventNotStartedMessage(selectedEvent?.date), 'err')
      return
    }
    if (!studentId) {
      flash('Missing student id on this registration row', 'err')
      return
    }
    setBusy(true)
    setMarkingId(studentId)
    const { data, error } = await markAttendance({
      eventId,
      studentId,
      attended: true,
      method: ATTENDANCE_METHOD.MANUAL,
      markedBy: user?.id,
    })
    setBusy(false)
    setMarkingId('')
    if (error) {
      flash(error.message || 'Could not mark attendance', 'err')
      return
    }
    // Optimistic UI so Present shows immediately
    setAttendance((prev) => {
      const others = (prev || []).filter((a) => a.student_id !== studentId)
      return [
        data || {
          event_id: eventId,
          student_id: studentId,
          attended: true,
          method: ATTENDANCE_METHOD.MANUAL,
        },
        ...others,
      ]
    })
    flash(`Attendance marked: ${label || 'student'} is Present`, 'ok')
    // Auto-refund security deposit after Present (Stripe sandbox)
    const reg = (regs || []).find((r) => String(studentKey(r)) === String(studentId))
    if (reg?.id && Number(reg.depositAmount || 0) > 0 && reg.paymentStatus === 'paid') {
      const { error: refundErr } = await processRegistrationPayment({
        registrationId: reg.id,
        eventId,
        kind: 'deposit',
        studentId,
      })
      if (refundErr) flash(`Present saved — deposit refund: ${refundErr.message}`, 'err')
      else flash(`Present + security deposit refunded`, 'ok')
    }
    await refresh()
  }

  async function scanQr() {
    if (!attendanceUnlocked) {
      flash(eventNotStartedMessage(selectedEvent?.date), 'err')
      return
    }
    const { data, error } = parseAttendancePayload(qrText)
    if (error) {
      flash(error.message, 'err')
      return
    }
    if (!eventId) {
      flash('Select an event first', 'err')
      return
    }
    if (String(data.eventId) !== String(eventId)) {
      flash('QR belongs to a different event — switch the event selector', 'err')
      return
    }
    setBusy(true)
    const { data: row, error: err } = await markAttendance({
      eventId: data.eventId,
      studentId: data.studentId,
      attended: true,
      method: ATTENDANCE_METHOD.QR,
      markedBy: user?.id,
    })
    setBusy(false)
    if (err) {
      flash(err.message || 'QR mark failed', 'err')
      return
    }
    setAttendance((prev) => {
      const others = (prev || []).filter((a) => a.student_id !== data.studentId)
      return [row || { event_id: data.eventId, student_id: data.studentId, attended: true, method: 'qr' }, ...others]
    })
    setQrText('')
    flash('QR attendance recorded — student is Present', 'ok')
    const reg = (regs || []).find((r) => String(studentKey(r)) === String(data.studentId))
    if (reg?.id && Number(reg.depositAmount || 0) > 0 && reg.paymentStatus === 'paid') {
      const { error: refundErr } = await processRegistrationPayment({
        registrationId: reg.id,
        eventId: data.eventId,
        kind: 'deposit',
        studentId: data.studentId,
      })
      if (refundErr) flash(`QR Present — deposit refund: ${refundErr.message}`, 'err')
      else flash('QR Present + security deposit refunded', 'ok')
    }
    await refresh()
  }

  async function setRegStatus(id, status) {
    const { error } = await updateRegistrationStatus(id, status)
    if (error) flash(error.message, 'err')
    else {
      flash(`Registration ${status}`, 'ok')
      refresh()
    }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !eventId) return
    setBusy(true)
    const { data: up, error: upErr } = await uploadEventMedia(file, { folder: `events/${eventId}` })
    if (upErr) {
      setBusy(false)
      flash(upErr.message, 'err')
      return
    }
    const isVideo = String(file.type || '').startsWith('video')
    const { error } = await addMedia({
      eventId,
      fileUrl: up.publicUrl,
      fileType: isVideo ? 'video' : 'image',
      caption,
      uploadedBy: user?.id,
    })
    setBusy(false)
    if (error) flash(error.message, 'err')
    else {
      flash('Media uploaded to gallery', 'ok')
      setCaption('')
      setMediaTick((n) => n + 1)
      e.target.value = ''
    }
  }

  const attendedIds = new Set(
    (attendance || [])
      .filter((a) => a.attended)
      .map((a) => String(a.student_id)),
  )

  const methodByStudent = useMemo(() => {
    const m = new Map()
    for (const a of attendance || []) {
      if (a?.student_id) m.set(String(a.student_id), a.method)
    }
    return m
  }, [attendance])

  const confirmed = (regs || []).filter(
    (r) => r.status === REGISTRATION_STATUS.CONFIRMED || r.status === 'confirmed',
  )

  const certIds = new Set((certs || []).map((c) => String(c.student_id)))
  const presentForCerts = confirmed.filter((r) => attendedIds.has(String(studentKey(r))))

  async function issueOne(studentId, label) {
    if (!certsUnlocked) {
      flash('Certificates unlock after the event end time', 'err')
      return
    }
    if (!attendedIds.has(String(studentId))) {
      flash('Mark attendance Present before issuing a certificate', 'err')
      return
    }
    setBusy(true)
    const { error } = await issueCertificate({
      eventId,
      studentId,
      certificateUrl: certUrl || null,
    })
    setBusy(false)
    if (error) flash(error.message, 'err')
    else {
      flash(`Certificate issued${label ? `: ${label}` : ''}`, 'ok')
      refresh()
    }
  }

  async function issueAllPresent() {
    if (!certsUnlocked) {
      flash('Certificates unlock after the event end time', 'err')
      return
    }
    const pending = presentForCerts.filter((r) => !certIds.has(String(studentKey(r))))
    if (!pending.length) {
      flash('All present students already have certificates', 'ok')
      return
    }
    setBusy(true)
    let ok = 0
    for (const r of pending) {
      const sid = studentKey(r)
      const { error } = await issueCertificate({
        eventId,
        studentId: sid,
        certificateUrl: certUrl || null,
      })
      if (!error) ok += 1
    }
    setBusy(false)
    flash(`Issued ${ok}/${pending.length} certificates`, ok ? 'ok' : 'err')
    refresh()
  }

  const phaseLabel =
    phase === 'live'
      ? 'Live now'
      : phase === 'starting_soon'
        ? 'Starting soon'
        : phase === 'ended'
          ? 'Ended — certificates open'
          : phase === 'upcoming'
            ? 'Upcoming'
            : ''

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Event operations</div>
          <h1>Attendance & certificates</h1>
          <p>Mark attendance on event day. After end time, issue certificates to Present students.</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!eventId}
            onClick={() => setStationPosterOpen(true)}
            data-testid="button-open-station-poster"
          >
            <QrCode size={14} /> Station QR poster (PDF)
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className="surface"
          style={{
            padding: '12px 16px',
            marginBottom: 14,
            borderColor: statusKind === 'err' ? 'var(--danger)' : 'var(--lime)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
          data-testid="attendance-status"
        >
          {statusKind === 'err' ? (
            <span className="muted" style={{ color: 'var(--danger)' }}>{statusMsg}</span>
          ) : (
            <>
              <CheckCircle2 size={16} color="var(--lime)" />
              <span style={{ fontSize: 13 }}>{statusMsg}</span>
            </>
          )}
        </div>
      )}

      <div className="surface" style={{ padding: 14, marginBottom: 16 }}>
        <label className="label">Event</label>
        <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)} data-testid="select-ops-event">
          {!mine.length && <option value="">No events yet</option>}
          {mine.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} · {e.status}
            </option>
          ))}
        </select>
        {selectedEvent && (
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Schedule: <strong>{formatEventSchedule(selectedEvent)}</strong>
            {phaseLabel ? ` · ${phaseLabel}` : ''}
            {!selectedEvent.endTime ? ' · tip: set End time on Edit for accurate Live/certificates' : ''}
          </p>
        )}
        <div className="chips" style={{ marginTop: 12 }}>
          {[
            ['attendance', 'Attendance / QR'],
            ['registrations', 'Registrations'],
            ['certificates', 'Certificates'],
            ['media', 'Gallery upload'],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'attendance' && (
        <div className="grid-2">
          <div className="surface" style={{ padding: 18 }}>
            <div className="eyebrow">QR paste scanner</div>
            <h3 className="display" style={{ margin: '10px 0 12px', fontSize: 18 }}>
              Scan / paste code
            </h3>
            {!attendanceUnlocked && selectedEvent && (
              <p className="muted" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>
                {eventNotStartedMessage(selectedEvent.date)}
              </p>
            )}
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              Prefer the <strong>Station QR poster</strong> at the door (students scan with Camera / Lens).
              Backup: student opens <strong>My Passes</strong> → Copy QR payload → paste here.
            </p>
            <textarea
              className="input"
              rows={3}
              value={qrText}
              onChange={(e) => setQrText(e.target.value)}
              placeholder="ES|eventId|studentId|token"
              data-testid="input-qr-paste"
            />
            <button className="btn btn-primary" style={{ marginTop: 12 }} type="button" disabled={busy || !eventId || !attendanceUnlocked} onClick={scanQr}>
              <QrCode size={14} /> {busy ? 'Marking…' : 'Mark from QR'}
            </button>
          </div>
          <div className="surface table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {confirmed.map((r) => {
                  const sid = String(studentKey(r))
                  const present = sid && attendedIds.has(sid)
                  const name = r.student?.full_name || sid || 'Student'
                  const pay = r.paymentStatus || 'not_required'
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{name}</strong>
                        <br />
                        <span className="subtle">{r.student?.email}</span>
                      </td>
                      <td>
                        {present ? (
                          <span style={{ color: 'var(--lime)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Check size={14} /> Present
                            <span className="subtle" style={{ color: 'var(--muted)', fontSize: 11 }}>
                              · {attendanceMethodLabel(methodByStudent.get(sid))}
                            </span>
                          </span>
                        ) : (
                          'Not marked'
                        )}
                      </td>
                      <td>
                        {pay === 'not_required' ? 'Free' : pay}
                        {Number(r.depositAmount) > 0 ? ` · dep $${Number(r.depositAmount).toFixed(2)}` : ''}
                      </td>
                      <td>
                        <button
                          className={present ? 'btn' : 'btn btn-primary'}
                          type="button"
                          disabled={busy || present || !sid || !attendanceUnlocked}
                          onClick={() => markManual(sid, name)}
                          data-testid={`button-mark-${sid}`}
                        >
                          {markingId === sid ? (
                            'Marking…'
                          ) : present ? (
                            <><Check size={14} /> Marked</>
                          ) : (
                            <><UserCheck size={14} /> Mark</>
                          )}
                        </button>
                        {pay === 'paid' && Number(r.depositAmount) > 0 && !r.depositRefundedAt && !present && (
                          <button
                            className="btn btn-quiet"
                            type="button"
                            style={{ marginLeft: 6 }}
                            disabled={busy}
                            onClick={async () => {
                              const { error } = await processRegistrationPayment({
                                registrationId: r.id,
                                eventId,
                                kind: 'forfeit',
                              })
                              flash(error ? error.message : 'Deposit marked forfeited', error ? 'err' : 'ok')
                              refresh()
                            }}
                          >
                            Forfeit
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!confirmed.length && (
              <p className="muted" style={{ padding: 16 }}>
                No confirmed registrations for this event yet. Students must register first.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'registrations' && (
        <div className="surface table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.student?.full_name || 'Student'}</strong>
                    <br />
                    <span className="subtle">{r.student?.enrollment_no || r.student?.email}</span>
                  </td>
                  <td>{r.status}</td>
                  <td>
                    {r.status === REGISTRATION_STATUS.PENDING && (
                      <>
                        <button className="btn btn-quiet" type="button" onClick={() => setRegStatus(r.id, REGISTRATION_STATUS.CONFIRMED)}>
                          <Check size={14} /> Approve
                        </button>
                        <button className="btn btn-quiet" type="button" onClick={() => setRegStatus(r.id, REGISTRATION_STATUS.CANCELLED)}>
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'certificates' && (
        <div className="surface" style={{ padding: 18 }}>
          <div className="eyebrow">After the event</div>
          <h3 className="display" style={{ margin: '10px 0 8px', fontSize: 18 }}>Issue certificates</h3>
          {!certsUnlocked ? (
            <p className="muted" style={{ fontSize: 13, color: 'var(--danger)' }}>
              Certificates unlock after event end time ({selectedEvent ? formatEventSchedule(selectedEvent) : '—'}).
              Mark attendance during the event, then return here once it ends.
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              Event ended. Issue certificates only for students marked Present.
            </p>
          )}
          <label className="label" style={{ marginTop: 12 }}>Optional custom file URL</label>
          <input
            className="input"
            value={certUrl}
            onChange={(e) => setCertUrl(e.target.value)}
            placeholder="Leave empty — EventSphere auto-generates the certificate for students"
          />
          <p className="subtle" style={{ fontSize: 11, marginTop: 6 }}>
            Students get an auto-generated PNG / printable PDF. Only paste a URL if you already have a custom PDF online.
          </p>
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || !certsUnlocked || !presentForCerts.length}
              onClick={issueAllPresent}
              data-testid="button-issue-all-certs"
            >
              <Award size={14} /> Issue for all Present ({presentForCerts.filter((r) => !certIds.has(String(studentKey(r)))).length} pending)
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Attendance</th>
                  <th>Certificate</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {confirmed.map((r) => {
                  const sid = String(studentKey(r))
                  const present = sid && attendedIds.has(sid)
                  const issued = sid && certIds.has(sid)
                  const name = r.student?.full_name || sid || 'Student'
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{name}</strong>
                        <br />
                        <span className="subtle">{r.student?.email}</span>
                      </td>
                      <td>{present ? 'Present' : 'Not marked'}</td>
                      <td>{issued ? 'Issued' : '—'}</td>
                      <td>
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={busy || !certsUnlocked || !present || issued}
                          onClick={() => issueOne(sid, name)}
                          data-testid={`button-issue-cert-${sid}`}
                        >
                          <Award size={14} /> {issued ? 'Issued' : 'Issue'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!confirmed.length && (
              <p className="muted" style={{ padding: 16 }}>No confirmed registrations.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'media' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="surface" style={{ padding: 20 }}>
            <div className="eyebrow">Storage bucket · event-media</div>
            <h3 className="display" style={{ margin: '10px 0 12px', fontSize: 18 }}>
              Upload gallery media
            </h3>
            <label className="label">Caption</label>
            <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} />
            <label className="label" style={{ marginTop: 12, display: 'block' }}>
              File
            </label>
            <input className="input" type="file" accept="image/*,video/*" onChange={onUpload} disabled={busy || !eventId} data-testid="input-media-upload" />
            <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              Requires Supabase Storage bucket <code>event-media</code> (see supabase/eventsphere-phase-c.sql).
            </p>
            <p className="muted" style={{ fontSize: 11 }}>
              <Upload size={12} /> Files appear on the public /gallery page when not hidden.
            </p>
          </div>
          {eventId ? (
            <MediaModeration
              key={`${eventId}-${mediaTick}`}
              eventId={eventId}
              setToast={setToast}
              title="Moderate this event’s media"
            />
          ) : null}
        </div>
      )}

      <StationCheckinPoster
        event={selectedEvent}
        open={stationPosterOpen}
        onClose={() => setStationPosterOpen(false)}
        setToast={setToast}
      />
    </>
  )
}
