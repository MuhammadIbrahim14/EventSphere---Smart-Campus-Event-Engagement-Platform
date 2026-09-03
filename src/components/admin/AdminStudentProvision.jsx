import { useMemo, useState } from 'react'
import { Loader2, Upload, UserPlus } from 'lucide-react'
import {
  adminResetStudentPassword,
  normalizeEnrollment,
  provisionStudent,
  provisionStudentsBulk,
} from '@/services/enrollmentAuth'

function parseCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return []

  const split = (line) => {
    const out = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (ch === '"') {
        q = !q
        continue
      }
      if (ch === ',' && !q) {
        out.push(cur.trim())
        cur = ''
        continue
      }
      cur += ch
    }
    out.push(cur.trim())
    return out
  }

  const header = split(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'))
  const idx = {
    enrollment_no: header.findIndex((h) => h === 'enrollment_no' || h === 'enrollment'),
    full_name: header.findIndex((h) => h === 'full_name' || h === 'name'),
    temp_password: header.findIndex((h) => h === 'temp_password' || h === 'password'),
    department: header.findIndex((h) => h === 'department' || h === 'dept'),
  }

  if (idx.enrollment_no < 0 || idx.full_name < 0 || idx.temp_password < 0) {
    throw new Error('CSV needs headers: enrollment_no, full_name, temp_password[, department]')
  }

  return lines.slice(1).map((line) => {
    const cols = split(line)
    return {
      enrollment_no: cols[idx.enrollment_no] || '',
      full_name: cols[idx.full_name] || '',
      temp_password: cols[idx.temp_password] || '',
      department: idx.department >= 0 ? cols[idx.department] || '' : '',
    }
  })
}

/**
 * Admin form + CSV to provision campus students (enrollment-first).
 */
export default function AdminStudentProvision({ setToast, onCreated }) {
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [fullName, setFullName] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [department, setDepartment] = useState('')
  const [busy, setBusy] = useState(false)
  const [csvBusy, setCsvBusy] = useState(false)
  const [error, setError] = useState('')
  const [csvReport, setCsvReport] = useState(null)

  const samplePassword = useMemo(() => `Es${Math.random().toString(36).slice(2, 8)}9a`, [])

  async function onCreate(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { data, error: err } = await provisionStudent({
      enrollment_no: normalizeEnrollment(enrollmentNo),
      full_name: fullName.trim(),
      temp_password: tempPassword,
      department: department.trim() || undefined,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setToast?.(`Student ${data.enrollment || enrollmentNo} provisioned`)
    setEnrollmentNo('')
    setFullName('')
    setTempPassword('')
    setDepartment('')
    onCreated?.()
  }

  async function onCsv(file) {
    setError('')
    setCsvReport(null)
    if (!file) return
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (!rows.length) {
        setError('CSV has no data rows')
        return
      }
      setCsvBusy(true)
      const { data, error: err } = await provisionStudentsBulk(rows)
      setCsvBusy(false)
      if (err) {
        setError(err.message)
        return
      }
      setCsvReport(data)
      setToast?.(`CSV: ${data.created || 0} created, ${data.failed || 0} failed`)
      onCreated?.()
    } catch (err) {
      setCsvBusy(false)
      setError(err.message || 'CSV parse failed')
    }
  }

  return (
    <div className="surface" style={{ padding: 20, marginBottom: 18 }} data-testid="admin-student-provision">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <UserPlus size={18} />
        <div>
          <strong style={{ display: 'block' }}>Provision campus student</strong>
          <span className="muted" style={{ fontSize: 12 }}>
            Creates Auth login as enrollment@students.eventsphere.local — students use enrollment + temp password.
          </span>
        </div>
      </div>

      {error ? (
        <p className="muted" style={{ color: 'var(--danger)', marginBottom: 12 }}>
          {error}
        </p>
      ) : null}

      <form onSubmit={onCreate} className="form-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <label className="label">Enrollment no.</label>
          <input
            className="input"
            value={enrollmentNo}
            onChange={(e) => setEnrollmentNo(e.target.value)}
            required
            data-testid="input-provision-enrollment"
            placeholder="1544129"
          />
        </div>
        <div>
          <label className="label">Full name</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            data-testid="input-provision-name"
          />
        </div>
        <div>
          <label className="label">Temporary password</label>
          <input
            className="input"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            required
            minLength={8}
            data-testid="input-provision-password"
            placeholder={samplePassword}
          />
        </div>
        <div>
          <label className="label">Department (optional)</label>
          <input
            className="input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            data-testid="input-provision-department"
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="btn btn-primary" disabled={busy} data-testid="button-provision-student">
            {busy ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />}{' '}
            {busy ? 'Creating…' : 'Create student'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={14} /> CSV bulk import
        </label>
        <p className="muted" style={{ fontSize: 11, margin: '4px 0 10px' }}>
          Headers: enrollment_no, full_name, temp_password, department
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={csvBusy}
          data-testid="input-provision-csv"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            onCsv(f)
          }}
        />
        {csvBusy ? <p className="muted">Importing…</p> : null}
        {csvReport?.results ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Enrollment</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {csvReport.results.map((r, i) => (
                  <tr key={`${r.enrollment}-${i}`}>
                    <td>{r.enrollment || '—'}</td>
                    <td>{r.ok ? 'Created' : 'Failed'}</td>
                    <td>{r.ok ? r.userId : r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { adminResetStudentPassword }
