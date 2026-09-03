import { Link } from 'wouter'
import PublicShell from './PublicShell'

const GROUPS = [
  {
    title: 'Public',
    links: [
      ['/', 'Home'],
      ['/events', 'Campus events'],
      ['/about', 'About Us'],
      ['/contact', 'Contact Us'],
      ['/faq', 'FAQs'],
      ['/gallery', 'Media Gallery'],
      ['/sitemap', 'Sitemap'],
      ['/login', 'Campus / account login'],
      ['/signup?intent=guest', 'Public guest signup'],
    ],
  },
  {
    title: 'Student',
    links: [
      ['/student/dashboard', 'Dashboard'],
      ['/student/discover', 'Discover events'],
      ['/student/registrations', 'My registrations'],
      ['/student/saved', 'Saved events'],
      ['/student/passes', 'My passes'],
      ['/student/certificates', 'Certificates'],
      ['/student/calendar', 'Calendar'],
    ],
  },
  {
    title: 'Organizer',
    links: [
      ['/organizer/dashboard', 'Dashboard'],
      ['/organizer/events', 'My events'],
      ['/organizer/create-event', 'Create event'],
      ['/organizer/attendees', 'Attendance & QR'],
      ['/organizer/registrations', 'Registrations'],
      ['/organizer/announcements', 'Announcements'],
    ],
  },
  {
    title: 'Admin',
    links: [
      ['/admin/dashboard', 'Dashboard'],
      ['/admin/approvals', 'Event approvals'],
      ['/admin/users', 'Users'],
      ['/admin/reports', 'Reports'],
      ['/admin/announcements', 'Announcements'],
    ],
  },
]

export default function SitemapPage() {
  return (
    <PublicShell eyebrow="Find your way" title="Sitemap">
      <div className="grid-2">
        {GROUPS.map((g) => (
          <div className="surface" style={{ padding: 20 }} key={g.title}>
            <div className="eyebrow">{g.title}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0' }}>
              {g.links.map(([href, label]) => (
                <li key={href} style={{ marginBottom: 8 }}>
                  <Link href={href} className="muted" style={{ fontSize: 13 }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PublicShell>
  )
}
