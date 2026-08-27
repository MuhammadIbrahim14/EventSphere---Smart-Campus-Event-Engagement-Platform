import { Link } from 'wouter'

const PUBLIC_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQs' },
  { href: '/sitemap', label: 'Sitemap' },
  { href: '/events', label: 'Public events' },
]

const FOOTER_BY_ROLE = {
  student: [
    {
      title: 'Campus',
      links: [
        { href: '/student/dashboard', label: 'Dashboard' },
        { href: '/student/discover', label: 'Discover events' },
        { href: '/student/registrations', label: 'My registrations' },
        { href: '/student/passes', label: 'My passes' },
        { href: '/student/calendar', label: 'Calendar' },
      ],
    },
    {
      title: 'You',
      links: [
        { href: '/student/payments', label: 'My payments' },
        { href: '/student/saved', label: 'Saved events' },
        { href: '/student/certificates', label: 'Certificates' },
        { href: '/student/feedback', label: 'Feedback' },
        { href: '/student/notifications', label: 'Notifications' },
      ],
    },
    {
      title: 'Account',
      links: [
        { href: '/student/profile', label: 'Profile' },
        { href: '/student/settings', label: 'Settings' },
      ],
    },
  ],
  organizer: [
    {
      title: 'Workspace',
      links: [
        { href: '/organizer/dashboard', label: 'Dashboard' },
        { href: '/organizer/events', label: 'My events' },
        { href: '/organizer/create-event', label: 'Create event' },
      ],
    },
    {
      title: 'Operations',
      links: [
        { href: '/organizer/registrations', label: 'Registrations' },
        { href: '/organizer/attendees', label: 'Attendees' },
        { href: '/organizer/questions', label: 'Ask Organizer inbox' },
        { href: '/organizer/announcements', label: 'Announcements' },
        { href: '/organizer/analytics', label: 'Analytics' },
      ],
    },
    {
      title: 'Manage',
      links: [
        { href: '/organizer/categories', label: 'Categories' },
        { href: '/organizer/venues', label: 'Venues' },
        { href: '/organizer/profile', label: 'Profile' },
        { href: '/organizer/settings', label: 'Settings' },
      ],
    },
  ],
  admin: [
    {
      title: 'Control',
      links: [
        { href: '/admin/dashboard', label: 'Dashboard' },
        { href: '/admin/approvals', label: 'Event approvals' },
        { href: '/admin/users', label: 'Users' },
        { href: '/admin/reports', label: 'Reports' },
        { href: '/admin/audit', label: 'Audit activity' },
      ],
    },
    {
      title: 'Ecosystem',
      links: [
        { href: '/admin/events', label: 'Events' },
        { href: '/admin/registrations', label: 'Registrations' },
        { href: '/admin/payments', label: 'Payments' },
        { href: '/admin/growth', label: 'Promo & sponsors' },
        { href: '/admin/media', label: 'Media moderation' },
      ],
    },
    {
      title: 'Platform',
      links: [
        { href: '/admin/mascot-library', label: 'Mascot library' },
        { href: '/admin/neon-trail', label: 'Neon trail' },
        { href: '/admin/profile', label: 'Profile' },
        { href: '/admin/settings', label: 'Settings' },
      ],
    },
  ],
}

const ROLE_LABEL = {
  student: 'Student workspace',
  organizer: 'Organizer workspace',
  admin: 'Admin command',
}

/** Role-aware footer for campus shells — lives at scroll bottom, not on modals. */
export default function WorkspaceFooter({ role = 'student' }) {
  const groups = FOOTER_BY_ROLE[role] || FOOTER_BY_ROLE.student

  return (
    <footer className="es-workspace-footer" data-testid={`workspace-footer-${role}`}>
      <div className="es-workspace-footer__grid">
        <div className="es-workspace-footer__brand">
          <strong>EventSphere</strong>
          <p className="muted">{ROLE_LABEL[role] || 'Campus workspace'}</p>
          <p className="es-workspace-footer__hint">
            Quick links for this role — full navigation stays in the sidebar.
          </p>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <div className="eyebrow">{group.title}</div>
            <div className="es-workspace-footer__links">
              {group.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
        <div>
          <div className="eyebrow">Public site</div>
          <div className="es-workspace-footer__links">
            {PUBLIC_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="es-workspace-footer__copy">
        © {new Date().getFullYear()} EventSphere · Smart campus event management
      </div>
    </footer>
  )
}
