export const FUTURE_IMPROVEMENT_PHASES = [
  {
    id: 'security',
    label: 'Security & access',
    accent: 'var(--cyan)',
    items: [
      {
        title: 'Admin-provisioned student accounts',
        summary:
          'Institutes invite students by email — no open signup. Students log in with issued credentials, then change email via OTP for privacy.',
        tags: ['Closed campus', 'OTP', 'RLS'],
      },
      {
        title: 'Bulk student import (CSV)',
        summary:
          'Admins upload enrollment lists; accounts, roles, and welcome invites are generated in one batch.',
        tags: ['Admin', 'Automation'],
      },
      {
        title: 'SSO / institutional login',
        summary:
          'Optional Google Workspace or Microsoft Entra sign-in for universities that already manage identity centrally.',
        tags: ['SSO'],
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform scale',
    accent: 'var(--violet)',
    items: [
      {
        title: 'Multi-institution (multi-tenant)',
        summary:
          'One EventSphere deployment serving many schools — each with isolated data, branding, and admin.',
        tags: ['SaaS', 'White-label'],
      },
      {
        title: 'Stripe Connect payouts',
        summary:
          'Automated organizer settlements to bank accounts instead of offline admin marking.',
        tags: ['Payments', 'PKR'],
      },
      {
        title: 'Advanced audit & compliance',
        summary:
          'Exportable audit trails, data retention policies, and role change history for institutional compliance.',
        tags: ['Audit', 'Reports'],
      },
    ],
  },
  {
    id: 'experience',
    label: 'Campus experience',
    accent: 'var(--lime)',
    items: [
      {
        title: 'Progressive Web App (PWA)',
        summary:
          'Install on phone home screen, offline pass cache, and push notifications for reminders.',
        tags: ['Mobile', 'Offline'],
      },
      {
        title: 'SMS + WhatsApp notify hooks',
        summary:
          'Critical alerts (payment, waitlist, event cancel) via SMS or WhatsApp Business API alongside email.',
        tags: ['Notify'],
      },
      {
        title: 'AI-assisted discovery',
        summary:
          'Smarter event recommendations from interests, attendance history, and department trends.',
        tags: ['AI', 'Recommendations'],
      },
      {
        title: 'Urdu / bilingual UI',
        summary:
          'Campus-wide language toggle for public pages and student panel copy.',
        tags: ['i18n'],
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    accent: 'var(--hot)',
    items: [
      {
        title: 'LMS bridge (Moodle / Canvas)',
        summary:
          'Sync course cohorts and auto-invite students registered in a campus LMS module.',
        tags: ['LMS'],
      },
      {
        title: 'Calendar two-way sync',
        summary:
          'Google / Outlook calendar write-back when students register — not just ICS export.',
        tags: ['Calendar'],
      },
      {
        title: 'Public API for partners',
        summary:
          'Read-only API keys for sponsors, analytics dashboards, or campus mobile apps.',
        tags: ['API'],
      },
    ],
  },
]
