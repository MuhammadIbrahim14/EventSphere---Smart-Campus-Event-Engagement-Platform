import PublicShell from './PublicShell'

export default function AboutPage() {
  return (
    <PublicShell eyebrow="Who we are" title="About EventSphere">
      <div className="surface" style={{ padding: 24 }}>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          EventSphere is a smart campus event and engagement platform. Students discover and register for
          campus gatherings, organizers run events end-to-end, and admins keep quality and capacity under control.
        </p>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.7, marginTop: 14 }}>
          Built for Techwiz 2026 as a full-stack campus experience: live registrations, waitlists, attendance,
          gallery, certificates, and role-based workspaces.
        </p>
      </div>
    </PublicShell>
  )
}
