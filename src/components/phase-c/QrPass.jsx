import { QRCodeSVG } from 'qrcode.react'
import { buildAttendancePayload } from '@/lib/qrPayload'

export default function QrPass({
  eventId,
  studentId,
  token,
  size = 108,
  label = 'Attendance QR code',
}) {
  const value = buildAttendancePayload({ eventId, studentId, token })
  if (!value) {
    return (
      <div className="qr" role="img" aria-label="QR unavailable">
        <span className="sr-only">QR unavailable</span>
      </div>
    )
  }
  return (
    <div
      className="qr"
      style={{
        background: '#fff',
        display: 'grid',
        placeItems: 'center',
        padding: 6,
        width: size + 12,
        height: size + 12,
      }}
      role="img"
      aria-label={label}
      title={label}
    >
      <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
      <span className="sr-only">{label}. Show this code to the organizer for check-in.</span>
    </div>
  )
}
