// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  AlertCircle, ArrowLeft, ArrowRight, BarChart3, Bell, Bookmark, Building2, Calendar,
  CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock, Copy, CreditCard, Download,
  Edit3, Eye, FileCheck2, Home, LayoutDashboard, ListFilter, LogOut, MapPin, Menu, Megaphone,
  Moon, MoreHorizontal, Pencil, Plus, Search, Send, Settings, Share2, ShieldCheck, SlidersHorizontal,
  Sparkles, Sun, Ticket, Trash2, UserCheck, UserRound, Users, X, XCircle, Zap, Smile
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { useAuth } from '@/context/AuthContext';
import { homePathForRole, uiRoleFromProfile, ROLES } from '@/constants/roles';
import { ANNOUNCEMENT_AUDIENCE, EVENT_CATEGORIES, EVENT_STATUS } from '@/constants/domain';
import AdminUsersLive from '@/components/admin/AdminUsersLive';
import AdminNeonTrailControl from '@/components/admin/AdminNeonTrailControl';
import AdminMascotLibrary from '@/components/admin/AdminMascotLibrary';
import AdminPayments from '@/components/admin/AdminPayments';
import AdminMediaPage from '@/components/admin/AdminMediaPage';
import SignupForm from '@/components/auth/SignupForm';
import VerifyForm from '@/components/auth/VerifyForm';
import { useEventSphereData } from '@/hooks/useEventSphereData';
import AboutPage from '@/pages/public/AboutPage';
import ContactPage from '@/pages/public/ContactPage';
import FaqPage from '@/pages/public/FaqPage';
import GalleryPage from '@/pages/public/GalleryPage';
import SitemapPage from '@/pages/public/SitemapPage';
import GuestHome, { GuestEventsPage } from '@/pages/public/GuestHome';
import GuestEventDetail from '@/pages/public/GuestEventDetail';
import { resolvePostAuthPath, readNextFromSearch, stashAuthNext } from '@/lib/authReturn';
import LiveAnnouncements from '@/components/phase-c/LiveAnnouncements';
import OrganizerOpsPanel from '@/components/phase-c/OrganizerOpsPanel';
import StudentCertificates from '@/components/phase-c/StudentCertificates';
import StudentFeedback from '@/components/phase-c/StudentFeedback';
import QrPass from '@/components/phase-c/QrPass';
import EventShareBar from '@/components/phase-d/EventShareBar';
import EventReviews from '@/components/phase-d/EventReviews';
import StoryShareButton from '@/components/phase-d/StoryShareButton';
import AskOrganizerButton from '@/components/shared/AskOrganizerButton';
import LiveCountdown from '@/components/shared/LiveCountdown';
import SponsorStrip from '@/components/shared/SponsorStrip';
import VenueMapViewer from '@/components/shared/VenueMapViewer';
import CampusFavPanel from '@/components/shared/CampusFavPanel';
import AttendeeBadgeCard from '@/components/shared/AttendeeBadgeCard';
import StudentAchievements from '@/components/shared/StudentAchievements';
import OrganizerQuestionsInbox from '@/components/organizer/OrganizerQuestionsInbox';
import AdminGrowthHub from '@/components/admin/AdminGrowthHub';
import { STUDENT_INTERESTS } from '@/constants/domain';
import { getProfileInterests, saveProfileInterests } from '@/services/interests';
import { applyReferralCode, getMyReferralCode } from '@/services/growth';
import CategoriesManager from '@/components/ops/CategoriesManager';
import VenuesManager from '@/components/ops/VenuesManager';
import RegistrationsDirectory from '@/components/ops/RegistrationsDirectory';
import AuditActivity from '@/components/ops/AuditActivity';
import CreateEventForm from '@/components/ops/CreateEventForm';
import OrganizerEventManage from '@/components/ops/OrganizerEventManage';
import StudentCalendar from '@/components/student/StudentCalendar';
import StudentPayments from '@/components/student/StudentPayments';
import StudentExperienceBridge from '@/components/student/StudentExperienceBridge';
import StudentDashboard from '@/components/student/StudentDashboard';
import {
  EsEventCard,
  EsPageChrome,
  EsScrollMotion,
  EsBrandLogo,
  OrganizerDashboard,
  AdminDashboard,
  EventVisualFields,
} from '@/components/design-system';
import { bannerForEvent, characterForEvent } from '@/constants/campusCharacters';
import { supabase } from '@/lib/supabase';
import { createMyNotice } from '@/services/studentExperience';
import {
  notifyStudentEmail,
  paymentSuccessEmailCopy,
  registrationEmailCopy,
} from '@/lib/studentNotify';
import { downloadCsv } from '@/lib/csvExport';
import { todayLocalDate, getEventPhase, formatEventSchedule, minutesUntilStart } from '@/lib/eventDate';
import { eventRequiresPayment, formatMoney, formatRegistrationCloses, isRegistrationClosed, pricingLabel } from '@/lib/eventMappers';
import { PAYMENT_STATUS, PAYMENT_STATUS_LABEL } from '@/constants/domain';
import { confirmCheckoutSession, createCheckoutSession, processRegistrationPayment } from '@/services/payments';
import { applyPromoDiscount, validatePromoCode } from '@/services/growth';
import { listAnnouncements } from '@/services/announcements';
import { listCategories } from '@/services/categories';
const queryClient = new QueryClient();

const PUBLIC_THEME_PATHS = ['/', '/login', '/signup', '/verify-email', '/about', '/contact', '/faq', '/gallery', '/sitemap', '/events'];

function isPublicPath(path) {
  if (!path) return false;
  if (PUBLIC_THEME_PATHS.includes(path)) return true;
  if (path.startsWith('/events/')) return true;
  return false;
}

function applyThemeClass(value) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(value);
  localStorage.setItem('eventsphere_theme', value);
}

/** Cinematic EventSphere theme FX — overlay only; does not touch app logic. */
function playThemeSpectacle(x, y, toTheme) {
  document.querySelectorAll('.theme-spectacle').forEach((n) => n.remove());
  const layer = document.createElement('div');
  layer.className = `theme-spectacle theme-spectacle--${toTheme}`;
  layer.setAttribute('aria-hidden', 'true');
  layer.style.setProperty('--sx', `${x}px`);
  layer.style.setProperty('--sy', `${y}px`);
  const sparks = Array.from({ length: 28 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
  const shards = Array.from({ length: 12 }, (_, i) => `<b style="--i:${i}"></b>`).join('');
  layer.innerHTML = [
    '<div class="theme-spectacle__veil"></div>',
    '<div class="theme-spectacle__flash"></div>',
    '<div class="theme-spectacle__core"><span></span></div>',
    '<div class="theme-spectacle__ring r1"></div>',
    '<div class="theme-spectacle__ring r2"></div>',
    '<div class="theme-spectacle__ring r3"></div>',
    '<div class="theme-spectacle__orbit"></div>',
    `<div class="theme-spectacle__sparks">${sparks}</div>`,
    `<div class="theme-spectacle__shards">${shards}</div>`,
    '<div class="theme-spectacle__label">EVENTSPHERE</div>',
    `<div class="theme-spectacle__mode">${toTheme === 'light' ? 'DAWN PROTOCOL' : 'MIDNIGHT PROTOCOL'}</div>`,
  ].join('');
  document.body.appendChild(layer);
  requestAnimationFrame(() => layer.classList.add('is-on'));
  window.setTimeout(() => {
    layer.classList.add('is-out');
    window.setTimeout(() => layer.remove(), 420);
  }, 980);
}

const roles = {
  admin: { label: 'Admin', email: 'admin@eventsphere.com', name: 'Elena Park', initials: 'EP', color: 'violet' },
  organizer: { label: 'Organizer', email: 'organizer@eventsphere.com', name: 'Aarav Mehta', initials: 'AM', color: 'cyan' },
  student: { label: 'Student', email: 'student@eventsphere.com', name: 'Maya Khan', initials: 'MK', color: 'pink' }
};

function orbitIdentity(role, profile) {
  const base = roles[role] || roles.student;
  const name = profile?.full_name || base.name;
  const email = profile?.email || base.email;
  const initials = String(name || 'ES')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return { ...base, name, email, initials };
}

const categories = [...EVENT_CATEGORIES];

function iconFor(label) {
  const props = { size: 16, strokeWidth: 1.8 };
  const map = { Dashboard: LayoutDashboard, 'Command overview': LayoutDashboard, Events: CalendarDays, 'My Events': CalendarDays, 'Create Event': Plus, 'Event Approvals': ClipboardCheck, Users, Organizers: UserCheck, Students: Users, Categories: SlidersHorizontal, Venues: Building2, Registrations: Ticket, Payments: CreditCard, 'My Payments': CreditCard, Media: Eye, Attendees: Users, Announcements: Megaphone, Reports: BarChart3, Analytics: BarChart3, 'Audit Activity': FileCheck2, Settings, 'Mascot Library': Smile, 'Neon Trail Control': Zap, 'Promo & Sponsors': CreditCard, 'Ask Organizer Inbox': Megaphone, 'Discover Events': Sparkles, 'My Registrations': Ticket, 'Saved Events': Bookmark, 'My Passes': Ticket, Certificates: FileCheck2, Feedback: Send, Calendar, Notifications: Bell, Profile: UserRound };
  const Icon = map[label] || Home;
  return <Icon {...props} />;
}
function Logo() {
  return <EsBrandLogo href="/" />;
}
function Toast({ text, onClose }) {
  useEffect(() => { const timer = setTimeout(onClose, 3200); return () => clearTimeout(timer); }, [onClose]);
  return <div className="toast" role="status" data-testid="status-toast"><CheckCircle2 size={16} color="var(--lime)" />{text}</div>;
}
function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><h2 id="modal-title">{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close modal" data-testid="button-close-modal"><X size={16} /></button></div>{children}</div></div>;
}
function ThemeToggle({ theme, setTheme }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={(e) => setTheme(next, e)}
      aria-label={`Switch to ${next} mode`}
      data-testid="button-theme"
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
function Sidebar({ role, path, open, setOpen, onLogout, identity }) {
  const sections = role === 'admin'
    ? [['CONTROL', ['Dashboard', 'Events', 'Event Approvals', 'Users', 'Organizers', 'Students']], ['ECOSYSTEM', ['Categories', 'Venues', 'Registrations', 'Payments', 'Media', 'Announcements', 'Reports', 'Audit Activity', 'Promo & Sponsors', 'Mascot Library', 'Neon Trail Control', 'Settings']]]
    : role === 'organizer'
      ? [['WORKSPACE', ['Dashboard', 'My Events', 'Create Event']], ['OPERATIONS', ['Categories', 'Registrations', 'Attendees', 'Ask Organizer Inbox', 'Venues', 'Announcements', 'Analytics', 'Settings']]]
      : [['CAMPUS', ['Dashboard', 'Discover Events', 'My Registrations', 'My Payments', 'Saved Events', 'My Passes', 'Certificates', 'Feedback', 'Calendar']], ['PERSONAL', ['Notifications', 'Profile', 'Settings']]];
  const paths = { Dashboard: `/${role}/dashboard`, Events: '/admin/events', 'Event Approvals': '/admin/approvals', Users: '/admin/users', Organizers: '/admin/organizers', Students: '/admin/students', Categories: `/${role}/categories`, Venues: `/${role}/venues`, Registrations: `/${role}/registrations`, Payments: '/admin/payments', Media: '/admin/media', Announcements: `/${role}/announcements`, Reports: '/admin/reports', 'Audit Activity': '/admin/audit', 'Mascot Library': '/admin/mascot-library', 'Neon Trail Control': '/admin/neon-trail', 'Promo & Sponsors': '/admin/growth', 'Ask Organizer Inbox': '/organizer/questions', Settings: `/${role}/settings`, 'My Events': '/organizer/events', 'Create Event': '/organizer/create-event', Attendees: '/organizer/attendees', Analytics: '/organizer/analytics', 'Discover Events': '/student/discover', 'My Registrations': '/student/registrations', 'My Payments': '/student/payments', 'Saved Events': '/student/saved', 'My Passes': '/student/passes', Certificates: '/student/certificates', Feedback: '/student/feedback', Calendar: '/student/calendar', Notifications: '/student/notifications', Profile: '/student/profile' };
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <span className="es-lightning-ring es-lightning-ring--sidebar" aria-hidden="true" />
      <div className="sidebar-head">
        <Logo />
        <button className="icon-btn drawer-toggle" type="button" onClick={() => setOpen(false)} aria-label="Close navigation">
          <X size={17} />
        </button>
      </div>
      <div className="sidebar-nav" aria-label="Primary navigation">
        {sections.map(([section, items]) => (
          <div className="sidebar-nav-group" key={section}>
            <div className="nav-section">{section}</div>
            <nav className="nav-list">
              {items.map((item) => {
                const href = paths[item];
                const active = path === href || (item === 'Dashboard' && path === `/${role}`);
                return (
                  <Link
                    key={item}
                    href={href}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={() => setOpen(false)}
                    data-testid={`link-nav-${item.toLowerCase().replaceAll(' ', '-')}`}
                  >
                    {iconFor(item)}
                    <span>{item}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="user-mini">
          <span className={`avatar ${role === 'organizer' ? 'avatar-cyan' : ''}`}>{identity.initials}</span>
          <span className="user-mini-copy">
            <strong>{identity.name}</strong>
            <span>{identity.label} access</span>
          </span>
          <button className="btn btn-quiet sidebar-logout" type="button" onClick={onLogout} aria-label="Sign out" data-testid="button-signout">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
function Header({ role, title, theme, setTheme, openNotifications, setOpenNotifications, setOpen, query, setQuery, onSearch, identity, feed = [] }) {
  const unread = feed.filter((n) => n.unread).length;
  return (
    <header className="topbar">
      <span className="es-lightning-ring es-lightning-ring--topbar" aria-hidden="true" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="icon-btn drawer-toggle" onClick={() => setOpen(true)} aria-label="Open navigation" data-testid="button-menu">
          <Menu size={18} />
        </button>
        <div>
          <div className="eyebrow">{identity.label} workspace</div>
          <div className="top-title">{title}</div>
        </div>
      </div>
      <div className="top-actions">
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch?.(query);
          }}
        >
          <Search size={15} />
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={role === 'student' ? 'Search events…' : 'Search events by title…'}
            aria-label="Global search"
            data-testid="input-global-search"
          />
        </form>
        <div style={{ position: 'relative' }}>
          <button className="icon-btn" onClick={() => setOpenNotifications(!openNotifications)} aria-label="Notifications" data-testid="button-notifications">
            <Bell size={17} />
            {unread > 0 && <span className="unread">{unread}</span>}
          </button>
          {openNotifications && (
            <div className="notification-menu">
              <div className="section-title" style={{ marginBottom: 5 }}>
                <h2>Notifications</h2>
                <button className="btn btn-quiet" type="button" onClick={() => setOpenNotifications(false)}>Close</button>
              </div>
              {!feed.length && <p className="muted" style={{ padding: 12, fontSize: 12 }}>No announcements or reminders yet.</p>}
              {feed.map((n, i) => (
                <div className="notification-row" key={n.id || i}>
                  <span
                    className="avatar"
                    style={{
                      width: 26,
                      height: 26,
                      background: n.kind === 'success' ? 'rgba(182,239,159,.18)' : 'rgba(154,123,255,.2)',
                      color: n.kind === 'success' ? 'var(--lime)' : 'var(--violet)',
                    }}
                  >
                    {n.kind === 'success' ? <Check size={13} /> : <Bell size={13} />}
                  </span>
                  <div>
                    <p>
                      <strong>{n.title}</strong>
                      <br />
                      {n.body}
                    </p>
                    <time>{n.time}</time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <span className="avatar" title={identity.name}>{identity.initials}</span>
      </div>
    </header>
  );
}
function Shell({ role, title, children, theme, setTheme, onLogout, identity, events = [], registrations = [], setToast }) {
  const [path, setLocation] = useLocation();
  const scrollRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [query, setQuery] = useState('');
  const [feed, setFeed] = useState([]);
  const [clock, setClock] = useState(0);

  // Refresh live/soon signals every 30s without full page reload
  useEffect(() => {
    const id = setInterval(() => setClock((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const audience =
        role === 'admin'
          ? ANNOUNCEMENT_AUDIENCE.ADMINS
          : role === 'organizer'
            ? ANNOUNCEMENT_AUDIENCE.ORGANIZERS
            : ANNOUNCEMENT_AUDIENCE.STUDENTS;
      const { data } = await listAnnouncements({ audience });
      const today = todayLocalDate();
      const regSet = new Set((registrations || []).map(String));
      const items = [];
      (data || []).slice(0, 6).forEach((a) => {
        items.push({
          id: `a-${a.id}`,
          title: a.title,
          body: `${a.body || ''} — from ${a.profiles?.full_name || 'staff'}`,
          time: a.published_at ? new Date(a.published_at).toLocaleString() : '',
          kind: 'info',
          unread: true,
        });
      });
      (events || [])
        .filter((e) => e.status === 'Approved' && e.date)
        .forEach((e) => {
          const mine = role !== 'student' || regSet.has(String(e.id));
          const phase = getEventPhase(e);
          if (phase === 'live' && (mine || role !== 'student')) {
            items.unshift({
              id: `live-${e.id}`,
              title: '● Live now',
              body: `${e.title} · ${formatEventSchedule(e)} · ${e.venue || ''}`,
              time: 'now',
              kind: 'success',
              unread: true,
            });
          } else if (phase === 'starting_soon' && mine) {
            const mins = minutesUntilStart(e);
            items.unshift({
              id: `soon-${e.id}`,
              title: 'Starting soon',
              body: `${e.title} starts in ${mins != null && mins > 0 ? `${mins} min` : 'a moment'} · ${e.venue || ''}`,
              time: e.time || '',
              kind: 'success',
              unread: true,
            });
          } else if (phase === 'ended' && mine && role === 'student') {
            items.push({
              id: `ended-${e.id}`,
              title: 'Event ended',
              body: `${e.title} finished. Certificates appear once the organizer issues them.`,
              time: formatEventSchedule(e),
              kind: 'info',
              unread: false,
            });
          } else if (e.date === today && phase === 'upcoming') {
            items.push({
              id: `start-${e.id}`,
              title: mine ? 'On your schedule today' : 'Event today',
              body: `${e.title} · ${formatEventSchedule(e)} · ${e.venue || ''}`,
              time: e.date,
              kind: 'success',
              unread: Boolean(mine),
            });
          } else if (e.date > today && (mine || role !== 'student')) {
            items.push({
              id: `up-${e.id}`,
              title: 'Upcoming event',
              body: `${e.title} on ${e.date}${e.time ? ` at ${e.time}` : ''}`,
              time: e.date,
              kind: 'info',
              unread: false,
            });
          }
        });
      if (alive) setFeed(items.slice(0, 14));
    })();
    return () => {
      alive = false;
    };
  }, [role, events, registrations, clock]);

  const onSearch = (q) => {
    const term = String(q || '').trim();
    if (!term) return;
    if (role === 'student') setLocation(`/student/discover?q=${encodeURIComponent(term)}`);
    else if (role === 'organizer') setLocation(`/organizer/events?q=${encodeURIComponent(term)}`);
    else setLocation(`/admin/events?q=${encodeURIComponent(term)}`);
    setOpen(false);
  };

  return (
    <div className="app-shell es-shell" data-role={role}>
      <StudentExperienceBridge role={role} events={events} registrations={registrations} setToast={setToast} />
      <Sidebar role={role} path={path} open={open} setOpen={setOpen} onLogout={onLogout} identity={identity} />
      <main className="main">
        <Header
          role={role}
          title={title}
          theme={theme}
          setTheme={setTheme}
          openNotifications={openNotifications}
          setOpenNotifications={setOpenNotifications}
          setOpen={setOpen}
          query={query}
          setQuery={setQuery}
          onSearch={onSearch}
          identity={identity}
          feed={feed}
        />
        <div
          className={`content es-stage ${role === 'student' ? 'stu-skin' : role === 'organizer' ? 'org-skin' : 'adm-skin'}`}
        >
          <span className="es-lightning-ring es-lightning-ring--content" aria-hidden="true" />
          <div className="es-stage__scroll page-enter" ref={scrollRef}>
            <EsScrollMotion scrollRef={scrollRef} routeKey={path}>
              {children}
            </EsScrollMotion>
          </div>
        </div>
      </main>
    </div>
  );
}
function StatCard({ label, value, note, icon, color }) {
  return <div className="surface stats-card" style={{ '--accent-color': color }} data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="stats-label"><span>{label}</span>{icon}</div><div className="stats-value">{value}</div><div className="stats-foot"><b>{note}</b> from last month</div></div>;
}
function Badge({ status }) {
  const label = status || 'Pending';
  return <span className={`badge badge-${String(label).toLowerCase()}`}>{label === 'Approved' && <Check size={11} />}{label}</span>;
}
function EventCard(props) {
  return <EsEventCard {...props} />;
}
function PageHead({ eyebrow, title, description, action }) {
  return <EsPageChrome eyebrow={eyebrow} title={title} description={description} action={action} />;
}
function EmptyState({ title, message, action }) { return <div className="empty es-empty"><Sparkles size={25} /><h3>{title}</h3><p>{message}</p>{action}</div>; }
function Chart({ title, value = '1,284', color = 'var(--cyan)' }) { return <div className="surface" style={{ padding: 18 }}><div className="section-title"><h2>{title}</h2><span className="eyebrow" style={{ color }}>{value}</span></div><div className="chart"><div className="chart-grid" /><svg viewBox="0 0 500 150" preserveAspectRatio="none"><path className="chart-line" style={{ stroke: color }} d="M0 130 C35 125, 49 95, 76 104 S117 119, 145 78 S190 93, 222 62 S264 70, 298 80 S339 40, 365 53 S405 38, 430 48 S470 22, 500 28" /></svg></div></div>; }
function Dashboard({ role, events, saved, registrations = [], setToast, setModal, go, actions, theme, setTheme }) {
  const isAdmin = role === 'admin'; const isOrg = role === 'organizer';
  const [manage, setManage] = useState(null);
  if (!isAdmin && !isOrg) {
    return (
      <StudentDashboard
        events={events}
        saved={saved}
        registrations={registrations}
        setToast={setToast}
        go={go}
        actions={actions}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }
  if (isOrg) {
    return (
      <>
        <OrganizerDashboard
          events={events}
          saved={saved}
          go={go}
          actions={actions}
          setToast={setToast}
          onManage={setManage}
        />
        {manage && (
          <OrganizerEventManage
            mode={manage.mode}
            event={manage.event}
            actions={actions}
            setToast={setToast}
            onClose={() => setManage(null)}
            onSwitchMode={(m) => setManage({ mode: m, event: manage.event })}
          />
        )}
      </>
    );
  }
  if (isAdmin) {
    return <AdminDashboard events={events} go={go} actions={actions} setToast={setToast} />;
  }
  return null;
}
function DataTable({ events, onOpen, onApprove }) {
  return <div className="surface table-wrap"><table className="data-table"><thead><tr><th>Event</th><th>Organizer</th><th>Date</th><th>Venue</th><th>Registrations</th><th>Status</th><th>Actions</th></tr></thead><tbody>{events.map(e => <tr key={e.id}><td><strong>{e.title}</strong><br /><span className="subtle">{e.category}</span></td><td>{e.organizer}</td><td>{e.date}</td><td>{e.venue}</td><td className="mono">{e.registrations}/{e.capacity}</td><td><Badge status={e.status} /></td><td><button className="btn btn-quiet" onClick={() => onOpen(e.id)} data-testid={`button-table-view-${e.id}`}><Eye size={14} /></button>{e.status === 'Pending' && <button className="btn btn-quiet" onClick={() => onApprove(e.id)} data-testid={`button-table-approve-${e.id}`}><Check size={14} /></button>}</td></tr>)}</tbody></table></div>;
}
function EventBrowser({ role, events, saved, setToast, go, actions }) {
  const [path] = useLocation();
  const initialQ = (() => {
    try {
      const q = path.includes('?') ? new URLSearchParams(path.split('?')[1]).get('q') : '';
      return q || '';
    } catch {
      return '';
    }
  })();
  const [term, setTerm] = useState(initialQ); const [category, setCategory] = useState('All'); const [sort, setSort] = useState('Recommended');
  const [catList, setCatList] = useState(categories);
  const [manage, setManage] = useState(null);
  useEffect(() => { if (initialQ) setTerm(initialQ); }, [initialQ]);
  useEffect(() => {
    (async () => {
      const { data, error } = await listCategories();
      if (!error && data?.length) setCatList(data.map((c) => c.name));
      else {
        const fromEvents = Array.from(new Set((events || []).map((e) => e.category).filter(Boolean)));
        if (fromEvents.length) setCatList([...new Set([...EVENT_CATEGORIES, ...fromEvents])]);
      }
    })();
  }, [events]);
  const source = role === 'student' ? events.filter(e => e.status === 'Approved') : events;
  const filtered = useMemo(() => source.filter(e => (category === 'All' || e.category === category) && `${e.title} ${e.organizer} ${e.venue}`.toLowerCase().includes(term.toLowerCase())).sort((a, b) => sort === 'Most Popular' ? b.registrations - a.registrations : sort === 'Newest' ? String(b.date).localeCompare(String(a.date)) : String(a.date).localeCompare(String(b.date))), [source, term, category, sort]);
  const edit = (event) => setManage({ mode: 'edit', event });
  const remove = (event) => setManage({ mode: 'delete', event: typeof event === 'object' ? event : events.find((e) => e.id === event) });
  const postpone = (event) => setManage({ mode: 'postpone', event });
  const cancelEv = (event) => setManage({ mode: 'cancel', event });
  const duplicate = async (event) => {
    const { error } = await actions.duplicateEvent(event);
    setToast(error ? error.message : 'Event duplicated as a draft');
  };
  const publish = async (id) => {
    const { error } = await actions.setStatus(id, EVENT_STATUS.PENDING);
    setToast(error ? error.message : 'Event submitted for admin approval');
  };
  const onSave = async (id) => {
    const { saved: nowSaved, error } = await actions.toggleSave(id);
    if (error) setToast(error.message);
    else setToast(nowSaved ? 'Event saved to your orbit' : 'Removed from saved events');
  };
  return <><PageHead eyebrow={role === 'organizer' ? 'Event operations' : role === 'student' ? 'Campus directory' : 'Campus directory'} title={role === 'organizer' ? 'My events' : role === 'student' ? 'Discover events' : 'Event library'} description={role === 'organizer' ? 'Edit, postpone, cancel, or delete — full control of your campus gatherings.' : 'Find the moments worth leaving your room for.'} action={role === 'organizer' ? <button className="btn btn-primary" onClick={() => go('/organizer/create-event')} data-testid="button-create-event"><Plus size={15} /> Create event</button> : null} /><SponsorStrip placement="discover" /><div className="surface" style={{ padding: 14, marginBottom: 18 }}><div className="toolbar"><div className="search"><Search size={15} /><input className="input" value={term} onChange={e => setTerm(e.target.value)} placeholder="Search events..." aria-label="Search events" data-testid="input-event-search" /></div><select className="input" style={{ width: 155 }} value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort events" data-testid="select-event-sort"><option>Recommended</option><option>Newest</option><option>Most Popular</option><option>Upcoming</option></select><ListFilter size={16} className="muted" /></div><div className="chips" style={{ marginTop: 13 }}>{['All', ...catList.slice(0, 8)].map(c => <button className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)} key={c} data-testid={`button-filter-${c.toLowerCase()}`}>{c}</button>)}</div></div>{filtered.length ? <div className="grid-3 stagger">{filtered.map(e => <EventCard key={e.id} event={e} saved={saved.includes(e.id)} onSave={onSave} onOpen={(id) => go(`/${role}/event/${id}`)} role={role} onEdit={edit} onDelete={remove} onDuplicate={duplicate} onPublish={publish} onPostpone={postpone} onCancel={cancelEv} />)}</div> : <div className="surface"><EmptyState title="No events in this orbit" message="Try another search or loosen your filters." action={<button className="btn" onClick={() => { setTerm(''); setCategory('All'); }}>Clear filters</button>} /></div>}{manage && <OrganizerEventManage mode={manage.mode} event={manage.event} actions={actions} setToast={setToast} onClose={() => setManage(null)} onSwitchMode={(m) => setManage({ mode: m, event: manage.event })} />}</>;
}
function Detail({ id, role, events, saved, registrations, registrationRows = [], setToast, go, actions }) {
  const { user, profile } = useAuth();
  const event = (events || []).find((e) => String(e.id) === String(id));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [manage, setManage] = useState(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState('');
  if (!event) {
    return <div className="surface"><EmptyState title="Event not found" message="This event is missing or not visible with your role." action={<button className="btn" onClick={() => go(`/${role}/dashboard`)}>Back</button>} /></div>;
  }
  const myReg = (registrationRows || []).find((r) => String(r.eventId) === String(event.id));
  const registered = (registrations || []).some((rid) => String(rid) === String(event.id));
  const phase = getEventPhase(event);
  const ended = phase === 'ended';
  const regClosed = !ended && isRegistrationClosed(event);
  const needsPay = eventRequiresPayment(event);
  const feeAmount = Number(event.entryFee || 0);
  const depositAmount = Number(event.securityDeposit || 0);
  const discountedFee = promoApplied
    ? applyPromoDiscount(feeAmount, promoApplied)
    : feeAmount;
  const payTotal = discountedFee + depositAmount;
  const closesLabel = formatRegistrationCloses(event);

  const applyPromo = async () => {
    setPromoError('');
    if (!promoInput.trim()) {
      setPromoError('Enter a promo code');
      return;
    }
    setPromoBusy(true);
    const { data, error } = await validatePromoCode(promoInput, {
      eventId: event.id,
      studentId: user?.id,
    });
    setPromoBusy(false);
    if (error) {
      setPromoApplied(null);
      setPromoError(error.message || 'Invalid code');
      return;
    }
    setPromoApplied(data);
    setToast?.(`Promo ${data.code} applied`);
  };

  const clearPromo = () => {
    setPromoApplied(null);
    setPromoInput('');
    setPromoError('');
  };

  const register = async () => {
    if (getEventPhase(event) === 'ended') {
      setToast('This event has ended — registration is closed');
      setConfirmOpen(false);
      return;
    }
    if (isRegistrationClosed(event)) {
      setToast('Registration is closed for this event');
      setConfirmOpen(false);
      return;
    }
    setProcessing(true);
    try {
      if (needsPay) {
        const origin = window.location.origin;
        const { data, error } = await createCheckoutSession({
          eventId: event.id,
          promoCode: promoApplied?.code || promoInput || undefined,
          successUrl: `${origin}/student/registrations?paid=1&event=${encodeURIComponent(event.id)}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/student/event/${encodeURIComponent(event.id)}`,
        });
        if (error) {
          setToast(error.message || 'Could not start Stripe checkout');
          return;
        }
        if (data?.alreadyPaid || data?.freeWithPromo) {
          setToast(
            data?.freeWithPromo
              ? 'Promo covered the fee — you are registered.'
              : 'Already paid — you are registered.',
          );
          setConfirmOpen(false);
          go('/student/registrations');
          return;
        }
        if (data?.url) {
          window.location.assign(data.url);
          return;
        }
        setToast('Checkout URL missing — check Stripe Edge Function setup');
        return;
      }

      const { data, error } = await actions.register(event.id);
      if (error) {
        setToast(error.message || 'Registration failed');
        return;
      }
      const status = data?.status;
      setToast(
        status === 'waitlist'
          ? 'Event is full — you are on the waitlist.'
          : status === 'pending'
            ? 'Registration pending organizer approval.'
            : "You're on the list. Your pass is ready.",
      );
      // Additive: confirmation / waitlist email (does not affect seat logic)
      try {
        const copy = registrationEmailCopy(event, status);
        const kind =
          status === 'waitlist'
            ? 'registration_waitlist'
            : 'registration_confirmed';
        await createMyNotice({
          kind,
          title: copy.title,
          body: copy.message,
          eventId: event.id,
        });
        await notifyStudentEmail({
          toEmail: profile?.email || user?.email,
          toName: profile?.full_name || user?.email || 'Student',
          ...copy,
          dedupeKey: `reg_${user?.id}_${event.id}_${status}`,
        });
      } catch {
        /* ignore notify errors */
      }
    } catch (err) {
      setToast(err?.message || 'Registration failed');
    } finally {
      setProcessing(false);
      setConfirmOpen(false);
    }
  };
  const toggleBookmark = async () => {
    const { saved: nowSaved, error } = await actions.toggleSave(event.id);
    if (error) setToast(error.message);
    else setToast(nowSaved ? 'Saved to your orbit' : 'Removed from saved events');
  };
  const studentTitle = ended
    ? (registered ? 'Event ended' : 'Registration closed')
    : regClosed
      ? (registered ? "You're on the list" : 'Registration closed')
    : (registered
      ? (myReg?.paymentStatus === PAYMENT_STATUS.PENDING ? 'Payment pending' : "You're on the list")
      : 'Make room for this.');
  const studentCopy = ended
    ? (registered
      ? 'Thanks for joining. Certificates unlock after the organizer issues them — check Certificates.'
      : 'This gathering has finished. Browse other approved events on Discover.')
    : regClosed
      ? (registered
        ? 'Registration is closed, but your place is saved. Check My Passes.'
        : `Registration closed${closesLabel ? ` on ${closesLabel}` : ''}. Ask the organizer if they extend the window.`)
    : (registered
      ? (myReg?.paymentStatus === PAYMENT_STATUS.PENDING
        ? 'Complete Stripe checkout to confirm your seat. Pass unlocks after payment.'
        : 'Your pass appears instantly in My Passes.')
      : (needsPay
        ? `Pay ${formatMoney(payTotal, event.currency)} via Stripe sandbox to reserve your seat.`
        : 'Save your place before this room reaches capacity.'));
  const studentCta = ended
    ? (registered
      ? <button className="btn btn-primary" style={{ width: '100%', marginTop: 15 }} type="button" onClick={() => go('/student/certificates')} data-testid="button-ended-certificates">View certificates <ArrowRight size={15} /></button>
      : <button className="btn btn-primary" style={{ width: '100%', marginTop: 15 }} type="button" onClick={() => go('/student/discover')} data-testid="button-ended-discover">Find other events <ArrowRight size={15} /></button>)
    : regClosed && !registered
      ? <button className="btn" style={{ width: '100%', marginTop: 15 }} type="button" disabled data-testid="button-registration-closed">Registration closed</button>
    : <button className="btn btn-primary" style={{ width: '100%', marginTop: 15 }} disabled={(registered && myReg?.paymentStatus !== PAYMENT_STATUS.PENDING) || processing} onClick={() => setConfirmOpen(true)} data-testid="button-register">
        {registered && myReg?.paymentStatus !== PAYMENT_STATUS.PENDING
          ? <><Check size={15} /> Registered</>
          : needsPay
            ? <>{registered ? 'Complete payment' : 'Pay & register'} <ArrowRight size={15} /></>
            : <>Register now <ArrowRight size={15} /></>}
      </button>;

  const mascot = characterForEvent(event);
  const banner = bannerForEvent(event);
  const heroStyle = {
    marginTop: 13,
    ...(ended ? { opacity: 0.95, filter: 'saturate(0.85)' } : {}),
    ...(banner
      ? {
          backgroundImage: `linear-gradient(120deg, rgba(7,6,12,.78), rgba(7,6,12,.45)), url(${banner})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {}),
  };

  return <>
    <button className="btn btn-quiet" onClick={() => go(role === 'student' ? '/student/discover' : '/organizer/events')} data-testid="button-back"><ArrowLeft size={14} /> Back to {role === 'student' ? 'discover' : 'events'}</button>
    <div className="surface detail-hero es-detail-hero" style={heroStyle}>
      <img className="es-detail-hero__mascot" src={mascot.src} alt="" aria-hidden="true" draggable={false} />
      <div className="es-detail-hero__body">
      <div className="eyebrow" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{event.category} · {event.organizer}</span>
        {needsPay ? <span className="badge" style={{ background: 'rgba(154,123,255,.25)', color: '#fff' }}>{pricingLabel(event)}</span> : <span className="badge" style={{ background: 'rgba(182,239,159,.25)', color: '#fff' }}>Free</span>}
        {ended && <span className="badge" style={{ background: 'rgba(135,144,179,.2)', color: 'var(--muted)' }}>Ended</span>}
        {regClosed && !ended && <span className="badge" style={{ background: 'rgba(255,120,120,.2)', color: 'var(--danger, #ff8a8a)' }}>Reg closed</span>}
        {phase === 'live' && <span className="badge" style={{ background: 'rgba(182,239,159,.18)', color: 'var(--lime)' }}>Live</span>}
        {phase === 'starting_soon' && <span className="badge" style={{ background: 'rgba(84,216,232,.18)', color: 'var(--cyan)' }}>Starting soon</span>}
      </div>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{formatEventSchedule(event)} · {event.venue}</p>
      {(phase === 'live' || phase === 'starting_soon') && (
        <div style={{ marginTop: 14 }}>
          <LiveCountdown event={event} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button className="btn" onClick={toggleBookmark} data-testid="button-detail-bookmark"><Bookmark size={15} fill={saved.includes(event.id) ? 'currentColor' : 'none'} /> {saved.includes(event.id) ? 'Saved' : 'Bookmark'}</button>
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(location.href); setToast('Event link copied'); }} data-testid="button-share"><Share2 size={15} /> Share</button>
      </div>
      </div>
    </div>
    <div className="detail-grid section">
      <div>
        <div className="detail-facts">
          <div className="surface fact"><div className="fact-label">When</div><div className="fact-value">{event.date}<br />{event.time || '—'}{event.endTime ? ` – ${event.endTime}` : ''}{ended ? ' · ENDED' : phase === 'live' ? ' · LIVE' : phase === 'starting_soon' ? ' · SOON' : ''}</div></div>
          <div className="surface fact"><div className="fact-label">Where</div><div className="fact-value">{event.venue}</div></div>
          <div className="surface fact"><div className="fact-label">{ended ? 'Status' : 'Capacity'}</div><div className="fact-value">{ended ? 'Event concluded' : `${event.capacity || 0} Total · ${event.registrations || 0} Registered · ${Math.max(0, (event.capacity || 0) - (event.registrations || 0))} Remaining`}</div></div>
          {closesLabel ? <div className="surface fact"><div className="fact-label">Registration</div><div className="fact-value">{regClosed ? 'Closed' : 'Closes'}<br />{closesLabel}</div></div> : null}
        </div>
        <div className="surface" style={{ padding: 20, marginTop: 15 }}>
          <div className="section-title"><h2>Event details</h2><span className="eyebrow">{event.registrations} registered</span></div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>{event.rules || 'Bring your campus ID and arrive 15 minutes early. Doors open before the first session.'}</p>
          {needsPay && (
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }} data-testid="text-detail-pricing">
              Pricing: {Number(event.entryFee) > 0 ? `Fee ${formatMoney(event.entryFee, event.currency)}` : 'No fee'}
              {Number(event.securityDeposit) > 0 ? ` · Deposit ${formatMoney(event.securityDeposit, event.currency)} (refundable on Present)` : ''}
            </p>
          )}
          {ended && <p className="muted" style={{ fontSize: 12, marginTop: 12, color: 'var(--cyan)' }}>Event window closed. Attendance and certificate actions follow organizer ops after end time.</p>}
          <div className="progress" style={{ marginTop: 18 }}><span style={{ width: `${Math.min(100, Math.round(((event.registrations || 0) / Math.max(event.capacity || 1, 1)) * 100))}%` }} /></div>
        </div>
      </div>
      <div className="surface" style={{ padding: 20, alignSelf: 'start' }}>
        <div className="eyebrow">{role === 'student' ? 'Your place in the sphere' : 'Event control'}</div>
        <h2 className="display" style={{ margin: '10px 0 8px', fontSize: 22 }}>{role === 'student' ? studentTitle : `${event.registrations} registered`}</h2>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>{role === 'student' ? studentCopy : (ended ? 'Event ended — issue certificates from Attendees → Certificates.' : 'Edit details, postpone with notice, cancel, or manage attendees.')}</p>
        {role === 'student' && myReg?.paymentStatus && myReg.paymentStatus !== PAYMENT_STATUS.NOT_REQUIRED && (
          <p className="eyebrow" style={{ marginTop: 10 }} data-testid="text-payment-status">
            {PAYMENT_STATUS_LABEL[myReg.paymentStatus] || myReg.paymentStatus}
          </p>
        )}
        {role === 'student' ? studentCta : <div className="event-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><button className="btn btn-primary" onClick={() => setManage({ mode: 'edit', event })} data-testid="button-detail-edit"><Pencil size={14} /> Edit</button><button className="btn" onClick={() => setManage({ mode: 'postpone', event })} data-testid="button-detail-postpone" disabled={ended}><Clock size={14} /> Postpone</button><button className="btn" onClick={() => go('/organizer/registrations')}><Ticket size={14} /> Registrations</button><button className="btn" onClick={() => go('/organizer/attendees')}><UserCheck size={14} /> {ended ? 'Certificates' : 'Attendance'}</button><button className="btn" onClick={() => go('/organizer/announcements')}><Megaphone size={14} /> Announce</button><button className="btn btn-danger" onClick={() => setManage({ mode: 'cancel', event })} data-testid="button-detail-cancel" disabled={ended}><XCircle size={14} /> Cancel</button></div>}
        {role === 'student' && !ended ? (
          <div style={{ marginTop: 12 }}>
            <AskOrganizerButton eventId={event.id} eventTitle={event.title} setToast={setToast} />
          </div>
        ) : null}
      </div>
    </div>
    <SponsorStrip placement="event_detail" title="Event partners" />
    <EventShareBar event={event} setToast={setToast} />
    <div style={{ marginTop: 12 }}>
      <StoryShareButton event={event} setToast={setToast} />
    </div>
    <VenueMapViewer eventId={event.id} venueId={event.venueId} />
    <CampusFavPanel
      eventId={event.id}
      eventTitle={event.title}
      canManage={role === 'organizer' || role === 'admin'}
      setToast={setToast}
    />
    {role === 'student' ? <div style={{ marginTop: 16 }}><StudentAchievements setToast={setToast} compact /></div> : null}
    <EventReviews eventId={event.id} />
    {confirmOpen && !ended && (
      <Modal
        title={processing ? (needsPay ? 'Opening Stripe…' : 'Joining the sphere…') : (needsPay ? 'Confirm & pay' : 'Confirm registration')}
        onClose={() => {
          if (processing) return;
          setConfirmOpen(false);
          clearPromo();
        }}
      >
        {processing ? (
          <div className="empty">
            <div style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}><Sparkles size={25} /></div>
            <h3>{needsPay ? 'Redirecting to Stripe Checkout' : 'Processing your place'}</h3>
            <p>{needsPay ? 'Sandbox test card: 4242 4242 4242 4242' : 'Writing your pass and calendar entry.'}</p>
          </div>
        ) : (
          <>
            <div className="surface-soft" style={{ padding: 15 }}>
              <strong>{event.title}</strong>
              <p className="muted" style={{ fontSize: 12 }}>{formatEventSchedule(event)}<br />{event.venue}</p>
              {needsPay && (
                <p style={{ fontSize: 13, marginTop: 10 }} data-testid="text-checkout-breakdown">
                  Fee{' '}
                  {promoApplied && discountedFee !== feeAmount ? (
                    <>
                      <span style={{ textDecoration: 'line-through', opacity: 0.55 }}>
                        {formatMoney(feeAmount, event.currency)}
                      </span>{' '}
                      {formatMoney(discountedFee, event.currency)}
                    </>
                  ) : (
                    formatMoney(feeAmount, event.currency)
                  )}
                  {depositAmount > 0 ? ` + Deposit ${formatMoney(depositAmount, event.currency)}` : ''}
                  <br />
                  <strong>Total {formatMoney(payTotal, event.currency)}</strong>
                  {promoApplied ? (
                    <span className="muted" style={{ display: 'block', fontSize: 11, marginTop: 4 }}>
                      Promo {promoApplied.code} applied
                      {promoApplied.discount_type === 'percent'
                        ? ` (−${promoApplied.value}%)`
                        : ` (−${formatMoney(promoApplied.value, event.currency)})`}
                      {' · deposit not discounted'}
                    </span>
                  ) : null}
                </p>
              )}
            </div>
            {needsPay ? (
              <div style={{ marginTop: 14 }}>
                <label className="label">Promo code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value.toUpperCase());
                      setPromoError('');
                    }}
                    placeholder="CAMPUS10"
                    disabled={Boolean(promoApplied)}
                    data-testid="input-checkout-promo"
                  />
                  {promoApplied ? (
                    <button type="button" className="btn" onClick={clearPromo}>
                      Clear
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn"
                      disabled={promoBusy || !promoInput.trim()}
                      onClick={applyPromo}
                      data-testid="button-apply-promo"
                    >
                      {promoBusy ? '…' : 'Apply'}
                    </button>
                  )}
                </div>
                {promoError ? (
                  <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{promoError}</p>
                ) : (
                  <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                    Optional — discounts entry fee only (security deposit stays full).
                  </p>
                )}
              </div>
            ) : null}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} disabled={processing} onClick={register} data-testid="button-confirm-registration">
              {needsPay ? <><Check size={15} /> Pay with Stripe</> : <><Check size={15} /> Confirm registration</>}
            </button>
          </>
        )}
      </Modal>
    )}
    {manage && <OrganizerEventManage mode={manage.mode} event={manage.event} actions={actions} setToast={setToast} onClose={() => setManage(null)} onSwitchMode={(m) => setManage({ mode: m, event: manage.event })} />}
  </>;
}
function GenericPage({ role, section, events, setToast, go, actions }) {
  const isApprovals = section === 'Event Approvals';
  const isReports = ['Reports', 'Analytics'].includes(section);
  if (section === 'Categories') return <CategoriesManager events={events} setToast={setToast} canManage />;
  if (section === 'Venues') return <VenuesManager events={events} setToast={setToast} canManage />;
  if (section === 'Users') return <AdminUsersLive setToast={setToast} roleFilter="all" />;
  if (section === 'Organizers') return <AdminUsersLive setToast={setToast} roleFilter={ROLES.ORGANIZER} />;
  if (section === 'Students') return <AdminUsersLive setToast={setToast} roleFilter={ROLES.USER} />;
  if (section === 'Announcements') return <LiveAnnouncements role={role} setToast={setToast} canPublish={role === 'admin' || role === 'organizer'} />;
  if (section === 'Registrations' || section === 'Operations') return <RegistrationsDirectory events={events} setToast={setToast} scope={role === 'organizer' ? 'organizer' : 'all'} />;
  if (section === 'Audit activity') return <AuditActivity setToast={setToast} />;
  if (isReports) return <><PageHead eyebrow={role === 'admin' ? 'Platform intelligence' : 'Event intelligence'} title={section === 'Analytics' ? 'Analytics' : 'Reports'} description="Read the signals behind every gathering — including priced events." action={<button className="btn btn-primary" onClick={() => { const { error } = downloadCsv('eventsphere-events.csv', events.map(e => ({ id: e.id, title: e.title, category: e.category, status: e.status, date: e.date, venue: e.venue, capacity: e.capacity, registrations: e.registrations, organizer: e.organizer, entry_fee: e.entryFee || 0, security_deposit: e.securityDeposit || 0, currency: e.currency || 'usd' }))); setToast(error ? error.message : 'CSV downloaded'); }} data-testid="button-export-csv"><Download size={14} /> Export CSV</button>} /><div className="grid-4"><StatCard label="Total events" value={String(events.length)} note="live" icon={<CalendarDays size={16} />} color="var(--violet)" /><StatCard label="Paid events" value={String(events.filter(e => Number(e.entryFee) > 0 || Number(e.securityDeposit) > 0).length)} note="priced" icon={<Ticket size={16} />} color="var(--pink)" /><StatCard label="Approved" value={String(events.filter(e => e.status === 'Approved').length)} note="live" icon={<CheckCircle2 size={16} />} color="var(--lime)" /><StatCard label="Fee volume $" value={String(events.reduce((n, e) => n + (Number(e.entryFee) || 0) * (Number(e.registrations) || 0), 0).toFixed(0))} note="est." icon={<BarChart3 size={16} />} color="var(--cyan)" /></div><div className="section grid-2"><Chart title="Registration growth" value={String(events.reduce((n, e) => n + (e.registrations || 0), 0))} /><Chart title="Open events" value={String(events.filter(e => e.status === 'Approved').length)} color="var(--violet)" /></div></>;
  if (isApprovals) return <ApprovalsPage events={events} setToast={setToast} actions={actions} />;
  return <div className="surface" style={{ padding: 24 }}><EmptyState title={section} message="This section is wired to live data routes." action={<button className="btn" type="button" onClick={() => go(`/${role}/dashboard`)}>Back to dashboard</button>} /></div>;
}
function ApprovalsPage({ events, setToast, actions }) {
  const [visualEvent, setVisualEvent] = useState(null);
  const [visualForm, setVisualForm] = useState({ bannerUrl: '', characterKey: '', characterUrl: '' });
  const [busy, setBusy] = useState(false);
  const pending = events.filter((e) => e.status === 'Pending');
  const openVisuals = (e) => {
    setVisualEvent(e);
    setVisualForm({
      bannerUrl: e.bannerUrl || '',
      characterKey: e.characterKey || '',
      characterUrl: e.characterUrl || '',
    });
  };
  const saveVisuals = async () => {
    if (!visualEvent) return;
    setBusy(true);
    const { error } = await actions.updateEvent(visualEvent.id, {
      bannerUrl: visualForm.bannerUrl?.trim() || null,
      characterKey: visualForm.characterKey || null,
      characterUrl: visualForm.characterUrl?.trim() || null,
    });
    setBusy(false);
    if (error) {
      setToast(error.message);
      return;
    }
    setToast('Event visuals updated');
    setVisualEvent(null);
  };
  return (
    <>
      <PageHead eyebrow="Review queue" title="Event approvals" description="Pending events awaiting admin decision (live from Supabase)." />
      <div className="grid-2 stagger">
        {pending.map((e) => {
          const mascot = characterForEvent(e);
          return (
            <div className="surface" style={{ padding: 20 }} key={e.id}>
              <div className="section-title">
                <Badge status={e.status} />
                <img src={mascot.src} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
              </div>
              <h2 className="display" style={{ margin: '13px 0 7px' }}>{e.title}</h2>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>{e.description}</p>
              <div className="detail-facts" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
                <div className="surface-soft fact"><div className="fact-label">Organizer</div><div className="fact-value">{e.organizer}</div></div>
                <div className="surface-soft fact"><div className="fact-label">Capacity</div><div className="fact-value">{e.capacity} seats</div></div>
              </div>
              <div className="event-actions">
                <button className="btn btn-primary" type="button" onClick={async () => { const { error } = await actions.setStatus(e.id, EVENT_STATUS.APPROVED); setToast(error ? error.message : `${e.title} approved`); }} data-testid={`button-approve-${e.id}`}><Check size={14} /> Approve event</button>
                <button className="btn btn-danger" type="button" onClick={async () => { const { error } = await actions.setStatus(e.id, EVENT_STATUS.REJECTED); setToast(error ? error.message : `${e.title} rejected`); }} data-testid={`button-reject-${e.id}`}><XCircle size={14} /> Reject</button>
                <button className="btn" type="button" onClick={() => openVisuals(e)} data-testid={`button-approvals-visuals-${e.id}`}>Visuals</button>
              </div>
            </div>
          );
        })}
      </div>
      {!pending.length && <div className="surface"><EmptyState title="Queue is clear" message="No pending events. Organizer submissions appear here." /></div>}
      {visualEvent && (
        <div className="surface" style={{ padding: 18, marginTop: 14 }} data-testid="approvals-visuals-panel">
          <div className="section-title">
            <h2>Visuals · {visualEvent.title}</h2>
            <button className="btn btn-quiet" type="button" onClick={() => setVisualEvent(null)}>Close</button>
          </div>
          <EventVisualFields
            bannerUrl={visualForm.bannerUrl}
            characterKey={visualForm.characterKey}
            characterUrl={visualForm.characterUrl}
            onChange={(patch) => setVisualForm((f) => ({ ...f, ...patch }))}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button className="btn" type="button" onClick={() => setVisualEvent(null)}>Cancel</button>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={saveVisuals}>{busy ? 'Saving…' : 'Save visuals'}</button>
          </div>
        </div>
      )}
    </>
  );
}
function CreateEvent({ setToast, go, actions }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'Technology', date: '', time: '', venue: 'Main Auditorium', capacity: '200' });
  const [busy, setBusy] = useState(false);
  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const save = async (status) => {
    if (!form.title.trim()) {
      setToast('Event title is required');
      return;
    }
    if (!form.date) {
      setToast('Start date is required');
      return;
    }
    setBusy(true);
    const { error } = await actions.createEvent(form, status === 'Draft' ? EVENT_STATUS.DRAFT : EVENT_STATUS.PENDING);
    setBusy(false);
    if (error) {
      setToast(error.message);
      return;
    }
    setToast(status === 'Draft' ? 'Draft saved' : 'Event submitted for admin approval');
    go('/organizer/events');
  };
  return <><PageHead eyebrow="Build a gathering" title="Create event" description="Give your next campus moment a clear shape." action={<button className="btn btn-quiet" onClick={() => go('/organizer/events')}><ArrowLeft size={14} /> Cancel</button>} /><div className="surface" style={{ padding: 22 }}><div className="eyebrow">01 · Basic information</div><div className="form-grid" style={{ marginTop: 18 }}><div className="full"><label className="label">Event title</label><input className="input" value={form.title} onChange={update('title')} placeholder="Name the moment" data-testid="input-event-title" /></div><div className="full"><label className="label">Description</label><textarea className="input" rows="4" value={form.description} onChange={update('description')} placeholder="What should people feel when they leave?" data-testid="input-event-description" /></div><div><label className="label">Category</label><select className="input" value={form.category} onChange={update('category')}>{categories.map(c => <option key={c}>{c}</option>)}</select></div><div><label className="label">Venue</label><select className="input" value={form.venue} onChange={update('venue')}>{venues.map(v => <option key={v.name}>{v.name}</option>)}</select></div><div><label className="label">Start date</label><input className="input" type="date" value={form.date} onChange={update('date')} data-testid="input-event-date" /></div><div><label className="label">Start time</label><input className="input" type="time" value={form.time} onChange={update('time')} /></div><div><label className="label">Capacity</label><input className="input" type="number" value={form.capacity} onChange={update('capacity')} /></div><div><label className="label">Registration type</label><select className="input"><option>Free registration</option><option>Approval required</option></select></div><div className="full"><label className="label">Event rules & requirements</label><textarea className="input" rows="3" placeholder="Optional notes for attendees" /></div></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 23 }}><button className="btn" disabled={busy} onClick={() => save('Draft')} data-testid="button-save-draft">Save draft</button><button className="btn btn-primary" disabled={busy} onClick={() => save('Pending')} data-testid="button-submit-event">Submit for approval <ArrowRight size={14} /></button></div></div></>;
}
function StudentRegistrationsPage({ events, registrations, registrationRows, go, actions, setToast, path, refresh }) {
  const { user, profile } = useAuth();
  const mine = events.filter((e) => registrations.includes(e.id));
  const [confirmingId, setConfirmingId] = useState(null);

  const syncPaidCheckout = async ({ sessionId, eventId, quiet } = {}) => {
    const { data, error } = await confirmCheckoutSession({ sessionId, eventId });
    if (error) {
      if (!quiet) setToast(error.message || 'Could not confirm payment yet');
      return false;
    }
    if (refresh) await refresh();
    if (!quiet) setToast(data?.alreadyPaid ? 'Already paid — seat confirmed' : 'Payment confirmed — seat unlocked');
    try {
      const ev = (events || []).find((e) => String(e.id) === String(eventId));
      const copy = paymentSuccessEmailCopy(ev);
      await createMyNotice({
        kind: 'payment_success',
        title: copy.title,
        body: copy.message,
        eventId: eventId || ev?.id,
      });
      await notifyStudentEmail({
        toEmail: profile?.email || user?.email,
        toName: profile?.full_name || user?.email || 'Student',
        ...copy,
        dedupeKey: `pay_ok_${user?.id}_${eventId || data?.registrationId}`,
      });
    } catch {
      /* ignore */
    }
    return true;
  };

  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const q = new URLSearchParams(search);
    if (q.get('paid') !== '1') return;
    const sessionId = q.get('session_id');
    const eventId = q.get('event');
    setToast('Confirming payment with Stripe…');
    void syncPaidCheckout({ sessionId, eventId });
    // once on return from Stripe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHead eyebrow="Your bookings" title="My registrations" description="Events you have claimed a seat for — including fee and deposit status." action={<button className="btn btn-primary" onClick={() => go('/student/discover')}>Find more</button>} />
      {mine.length ? (
        <div className="grid-3">
          {mine.map((e) => {
            const row = registrationRows.find((r) => String(r.eventId) === String(e.id));
            const payLabel = row?.paymentStatus && row.paymentStatus !== 'not_required'
              ? (PAYMENT_STATUS_LABEL[row.paymentStatus] || row.paymentStatus)
              : (eventRequiresPayment(e) ? 'Payment pending' : 'Free');
            return (
              <div className="surface" style={{ padding: 18 }} key={e.id}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge status={e.status} />
                  <span className="badge badge-draft">{payLabel}</span>
                </div>
                <h3 className="display" style={{ margin: '12px 0 6px', fontSize: 20 }}>{e.title}</h3>
                <p className="muted" style={{ fontSize: 12 }}>{e.date} · {e.venue}</p>
                {eventRequiresPayment(e) && (
                  <p className="subtle" style={{ fontSize: 11, marginTop: 6 }}>{pricingLabel(e)}</p>
                )}
                <div className="event-actions" style={{ marginTop: 14 }}>
                  <button className="btn btn-primary" type="button" onClick={() => go(`/student/event/${e.id}`)}>View</button>
                  {row?.paymentStatus === PAYMENT_STATUS.PENDING && (
                    <>
                      <button
                        className="btn"
                        type="button"
                        disabled={confirmingId === e.id}
                        onClick={async () => {
                          setConfirmingId(e.id);
                          const ok = await syncPaidCheckout({ eventId: e.id });
                          setConfirmingId(null);
                          if (!ok) go(`/student/event/${e.id}`);
                        }}
                      >
                        {confirmingId === e.id ? 'Checking…' : 'Confirm payment'}
                      </button>
                      <button className="btn" type="button" onClick={() => go(`/student/event/${e.id}`)}>Pay again</button>
                    </>
                  )}
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={async () => {
                      if (!confirm('Cancel this registration?')) return;
                      const { error } = await actions.cancelRegister(e.id);
                      if (!error && row?.id && row.paymentStatus === PAYMENT_STATUS.PAID) {
                        await processRegistrationPayment({ registrationId: row.id, eventId: e.id, kind: 'cancel' });
                      }
                      setToast(error ? error.message : 'Registration cancelled');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface">
          <EmptyState title="No registrations yet" message="Discover an approved event and register to see it here." action={<button className="btn btn-primary" onClick={() => go('/student/discover')}>Discover events</button>} />
        </div>
      )}
    </>
  );
}
function CalendarView({ events, registrations, go }) {
  return <StudentCalendar events={events} registrations={registrations} go={go} />;
}
function Passes({ events, registrations, registrationRows = [], go, identity, setToast }) {
  const { user } = useAuth();
  const attendee = identity?.name || 'Attendee';
  const [walletId, setWalletId] = useState(null);
  const list = events.filter((e) => {
    if (!registrations.includes(e.id)) return false;
    const row = registrationRows.find((r) => String(r.eventId) === String(e.id));
    if (!row) return true;
    if (row.status === 'pending_payment') return false;
    if (row.paymentStatus === PAYMENT_STATUS.PENDING || row.paymentStatus === PAYMENT_STATUS.EXPIRED) return false;
    return row.status === 'confirmed' || row.status === 'pending' || row.paymentStatus === PAYMENT_STATUS.NOT_REQUIRED || row.paymentStatus === PAYMENT_STATUS.PAID || row.paymentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED;
  });
  const walletEvent = list.find((e) => String(e.id) === String(walletId));
  const walletRow = walletEvent
    ? registrationRows.find((r) => String(r.eventId) === String(walletEvent.id))
    : null;

  useEffect(() => {
    if (!walletId) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setWalletId(null);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [walletId]);

  return (
    <>
      <PageHead eyebrow="Your credentials" title="My passes" description="Mobile wallet view for the door — large QR, high contrast, screen-reader friendly." />
      <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
        Open <strong>Wallet view</strong> on event day. QR encodes <code>ES|eventId|studentId|registrationId</code>. Attendance unlocks only on/after the event date.
      </p>
      {list.length ? (
        <div className="grid-2 stagger">
          {list.map((e) => {
            const row = registrationRows.find((r) => r.eventId === e.id);
            const payload = `ES|${e.id}|${user?.id || ''}|${row?.id || 'pass'}`;
            const payLabel = row?.paymentStatus && row.paymentStatus !== PAYMENT_STATUS.NOT_REQUIRED
              ? PAYMENT_STATUS_LABEL[row.paymentStatus]
              : 'Free';
            return (
              <div className="surface pass" key={e.id} data-testid={`card-pass-${e.id}`}>
                <div className="pass-top">
                  <div className="eyebrow">EventSphere · {payLabel}</div>
                  <h2 className="display" style={{ fontSize: 25, margin: '16px 0 6px' }}>{e.title}</h2>
                  <div className="muted" style={{ fontSize: 11 }}>{e.date} · {e.venue}</div>
                </div>
                <div className="pass-bottom">
                  <div>
                    <div className="subtle" style={{ fontSize: 9, letterSpacing: '.12em' }}>ATTENDEE</div>
                    <strong style={{ display: 'block', marginTop: 5 }}>{attendee}</strong>
                    <div className="subtle mono" style={{ marginTop: 16, fontSize: 10 }}>REG · ES-{String(e.id).slice(0, 4).toUpperCase()}</div>
                  </div>
                  <QrPass
                    eventId={e.id}
                    studentId={user?.id}
                    token={row?.id || 'pass'}
                    size={96}
                    label={`QR pass for ${e.title}`}
                  />
                </div>
                <div style={{ padding: '0 24px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => setWalletId(e.id)}
                    data-testid={`button-wallet-pass-${e.id}`}
                  >
                    Wallet view
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(payload);
                      setToast?.('QR payload copied');
                    }}
                    data-testid={`button-download-pass-${e.id}`}
                  >
                    <Download size={14} /> Copy QR payload
                  </button>
                  <button className="btn btn-quiet" type="button" onClick={() => go(`/student/event/${e.id}`)}>
                    View event
                  </button>
                </div>
                <div style={{ padding: '0 24px 18px' }}>
                  <AttendeeBadgeCard
                    name={attendee}
                    eventTitle={e.title}
                    roleLabel="Attendee"
                    eventDate={`${e.date || ''} · ${e.time || ''}`}
                    venue={e.venue}
                    setToast={setToast}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface">
          <EmptyState
            title="No passes yet"
            message="Register for an event (and complete payment if priced) to see your digital pass here."
            action={<button className="btn btn-primary" type="button" onClick={() => go('/student/discover')}>Discover events</button>}
          />
        </div>
      )}

      {walletEvent && (
        <div
          className="pass-wallet-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pass-wallet-title"
          onMouseDown={(e) => e.target === e.currentTarget && setWalletId(null)}
        >
          <div className="pass-wallet-sheet">
            <div className="pass-wallet-bar">
              <span className="eyebrow" style={{ color: 'inherit' }}>EventSphere wallet</span>
              <button className="icon-btn" type="button" onClick={() => setWalletId(null)} aria-label="Close wallet view">
                <X size={18} />
              </button>
            </div>
            <h2 id="pass-wallet-title" className="display" style={{ fontSize: 28, margin: '8px 0 6px', color: '#f4f5ff' }}>
              {walletEvent.title}
            </h2>
            <p className="muted" style={{ color: '#c9cbe0', margin: 0 }}>{walletEvent.date} · {walletEvent.venue}</p>
            <div className="pass-wallet-qr">
              <QrPass
                eventId={walletEvent.id}
                studentId={user?.id}
                token={walletRow?.id || 'pass'}
                size={220}
                label={`Fullscreen QR for ${walletEvent.title}`}
              />
            </div>
            <p style={{ color: '#f4f5ff', fontWeight: 600, margin: '18px 0 4px' }}>{attendee}</p>
            <p className="subtle" style={{ color: '#aeb1c8', fontSize: 12, margin: 0 }}>
              Hold phone steady for organizer scan · Esc to close
            </p>
            <button
              className="btn"
              type="button"
              style={{ marginTop: 18, width: '100%' }}
              onClick={() => {
                const payload = `ES|${walletEvent.id}|${user?.id || ''}|${walletRow?.id || 'pass'}`;
                navigator.clipboard?.writeText(payload);
                setToast?.('QR payload copied');
              }}
            >
              <Copy size={14} /> Copy payload
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function SettingsPage({ role, theme, setTheme, setToast, identity }) {
  const { user, profile, refreshProfile } = useAuth();
  const person = identity || roles[role] || roles.student;
  const [saved, setSaved] = useState(false);
  const [checks, setChecks] = useState([true, true, role === 'student' ? false : true]);
  const [interests, setInterests] = useState(() => getProfileInterests(profile));
  const [referral, setReferral] = useState({ code: '', points: 0 });
  const [friendCode, setFriendCode] = useState('');

  useEffect(() => {
    setInterests(getProfileInterests(profile));
  }, [profile]);

  useEffect(() => {
    if (role !== 'student' || !user?.id) return undefined;
    let alive = true;
    (async () => {
      const refRes = await getMyReferralCode(user.id);
      if (!alive) return;
      if (refRes.data) setReferral({ code: refRes.data.referral_code || '', points: refRes.data.wallet_points || 0 });
    })();
    return () => { alive = false; };
  }, [role, user?.id]);

  const toggleInterest = (tag) => {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const saveAll = async () => {
    if (role === 'student' && user?.id) {
      const { error } = await saveProfileInterests(user.id, interests);
      if (error) {
        setToast(error.message);
        return;
      }
      await refreshProfile?.();
    }
    try {
      const prefs = {
        ...(profile?.preferences || {}),
        notify: {
          reminders: checks[0],
          registrations: checks[1],
          announcements: checks[2],
        },
        interests: role === 'student' ? interests : (profile?.preferences?.interests || []),
      };
      if (user?.id) {
        await supabase.from('profiles').update({ preferences: prefs }).eq('id', user.id);
      }
    } catch {
      /* preferences column may be missing until SQL runs */
    }
    setSaved(true);
    setToast('Preferences saved');
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <>
      <PageHead eyebrow="Control your experience" title="Settings" description="Small choices that keep the sphere feeling like yours." />
      <div className="grid-2">
        <div className="surface" style={{ padding: 21 }}>
          <div className="eyebrow">Account</div>
          <h2 className="display" style={{ margin: '10px 0 18px' }}>Your identity</h2>
          <div className="form-grid">
            <div><label className="label">Full name</label><input className="input" defaultValue={person.name} /></div>
            <div><label className="label">Campus email</label><input className="input" defaultValue={person.email} /></div>
            <div className="full"><label className="label">Department / organization</label><input className="input" defaultValue={role === 'student' ? 'Computer Science' : role === 'organizer' ? 'Innovation & Entrepreneurship Cell' : 'Student Affairs'} /></div>
          </div>
        </div>
        <div className="surface" style={{ padding: 21 }}>
          <div className="eyebrow">Preferences</div>
          <h2 className="display" style={{ margin: '10px 0 18px' }}>Signals & appearance</h2>
          {(role === 'student' ? ['Event reminders (12h email)', 'Registration updates', 'Organizer announcements'] : role === 'organizer' ? ['New registration', 'Event approval', 'Event reminders'] : ['Email notifications', 'Approval notifications', 'Registration alerts']).map((x, i) => (
            <label key={x} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
              <span>{x}</span>
              <input type="checkbox" checked={checks[i]} onChange={() => setChecks(checks.map((v, n) => (n === i ? !v : v)))} data-testid={`checkbox-setting-${i}`} />
            </label>
          ))}
          <div style={{ marginTop: 19 }}>
            <label className="label">Appearance</label>
            <div className="chips">
              <button type="button" className={`chip ${theme === 'dark' ? 'active' : ''}`} onClick={(e) => setTheme('dark', e)}><Moon size={13} /> Midnight mode</button>
              <button type="button" className={`chip ${theme === 'light' ? 'active' : ''}`} onClick={(e) => setTheme('light', e)}><Sun size={13} /> Light mode</button>
            </div>
          </div>
        </div>
      </div>

      {role === 'student' ? (
        <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
          <div className="surface" style={{ padding: 21 }}>
            <div className="eyebrow">Personalization</div>
            <h2 className="display" style={{ margin: '10px 0 12px', fontSize: 20 }}>Your interests</h2>
            <p className="muted" style={{ fontSize: 11, marginBottom: 10 }}>Powers Recommended for You on your dashboard.</p>
            <div className="chips" style={{ flexWrap: 'wrap', gap: 8 }}>
              {STUDENT_INTERESTS.map((tag) => (
                <button key={tag} type="button" className={`chip ${interests.includes(tag) ? 'active' : ''}`} onClick={() => toggleInterest(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="surface" style={{ padding: 21 }}>
            <div className="eyebrow">Refer a friend</div>
            <h2 className="display" style={{ margin: '10px 0 12px', fontSize: 20 }}>Orbit points · {referral.points}</h2>
            <p className="muted" style={{ fontSize: 11 }}>Share your code. When a friend signs up with it, you earn +50 points.</p>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="full">
                <label className="label">Your referral code</label>
                <input className="input" readOnly value={referral.code || 'Generating…'} data-testid="input-my-referral" />
              </div>
              <div className="full">
                <label className="label">Enter a friend’s code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value={friendCode} onChange={(e) => setFriendCode(e.target.value)} placeholder="ABCD1234" />
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      const { error } = await applyReferralCode(user.id, friendCode);
                      if (error) setToast(error.message);
                      else {
                        setToast('Referral applied');
                        setFriendCode('');
                      }
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {role === 'student' ? (
        <div style={{ marginTop: 16 }}>
          <StudentAchievements setToast={setToast} />
        </div>
      ) : null}

      <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={saveAll} data-testid="button-save-settings">
        {saved ? <><Check size={14} /> Saved</> : 'Save preferences'}
      </button>
    </>
  );
}
function Landing() {
  return <GuestHome />;
}
function Login({ theme, setTheme }) {
  const [, setLocation] = useLocation();
  const { signIn, refreshProfile, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next = readNextFromSearch(typeof window !== 'undefined' ? window.location.search : '');
    if (next) stashAuthNext(next);
  }, []);

  async function doLogin(e) {
    e.preventDefault();
    setError('');
    if (!configured) {
      setError('Supabase is not configured. Add keys in .env');
      return;
    }
    setBusy(true);
    const { error: err, profile: p } = await signIn({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const latest = p || (await refreshProfile());
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (latest && latest.email_verified === false) {
      const next = readNextFromSearch(search);
      if (next) stashAuthNext(next);
      setLocation('/verify-email');
      return;
    }
    setLocation(resolvePostAuthPath(homePathForRole(latest?.role), search));
  }

  const signupHref = (() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const next = readNextFromSearch(search);
    return next ? `/signup?next=${encodeURIComponent(next)}` : '/signup';
  })();

  return (
    <div className="login-page es-public">
      <div className="login-shell">
        <div className="login-visual">
          <div>
            <Logo />
            <div className="eyebrow" style={{ marginTop: 65 }}>One campus. Infinite stories.</div>
            <h1>Make something<br /><span className="gradient-text">worth gathering for.</span></h1>
            <p>Sign in with your campus account. Your assigned role opens the right panel — student, organizer, or admin. Tip: open a <strong>separate tab</strong> (Ctrl+T) for each role — each tab keeps its own login.</p>
          </div>
          <div className="orbit-stat">
            <div className="avatar-stack">{['EP', 'AM', 'MK', 'NS'].map((x, i) => <span className={`avatar ${i % 2 ? 'avatar-cyan' : ''}`} key={x}>{x}</span>)}</div>
            <div>1,250<small>IN THE SPHERE</small></div>
          </div>
        </div>
        <form className="login-form" onSubmit={doLogin}>
          <div className="eyebrow">Welcome back</div>
          <h2>Sign in to EventSphere</h2>
          <p>Role comes from your profile (admin assigns organizer). Guests can browse public events without signing in.</p>
          <label className="label">Campus email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-login-email" />
          <label className="label" style={{ marginTop: 15 }}>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} data-testid="input-login-password" />
          {error && <p className="muted" style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}
          <div className="login-footer">
            <button type="button" className="btn btn-quiet" onClick={() => setLocation('/')}>Guest home</button>
            <button type="button" className="btn btn-quiet" onClick={() => setLocation(signupHref)}>Create an account</button>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 19 }} disabled={busy} data-testid="button-login">
            {busy ? 'Signing in…' : <>Continue <ArrowRight size={15} /></>}
          </button>
          <button type="button" className="btn btn-quiet" style={{ marginTop: 14 }} onClick={(e) => setTheme(theme === 'dark' ? 'light' : 'dark', e)}>
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />} {theme === 'dark' ? 'Light mode' : 'Midnight mode'}
          </button>
        </form>
      </div>
    </div>
  );
}
function Workspace({ role, events, saved, registrations, registrationRows, theme, setTheme, setToast, onLogout, identity, actions, refresh }) {
  const [path, setLocation] = useLocation(); const params = useParams(); const go = setLocation; const [modal, setModal] = useState(null);
  useEffect(() => { if (!path.startsWith(`/${role}`)) setLocation(`/${role}/dashboard`); }, [path, role, setLocation]);
  const parts = path.split('/').filter(Boolean);
  const segment = parts[1] || 'dashboard';
  const eventMatch = path.match(/\/event\/([^/?#]+)/);
  const id = eventMatch?.[1] || params.id || null;
  const detail = Boolean(eventMatch);
  const titles = { dashboard: role === 'admin' ? 'Command overview' : role === 'organizer' ? 'Organizer dashboard' : 'Student dashboard', events: role === 'organizer' ? 'My events' : 'Event library', discover: 'Discover events', approvals: 'Event approvals', users: 'Users', organizers: 'Organizers', students: 'Students', categories: 'Categories', venues: 'Venues', registrations: 'Registrations', payments: role === 'student' ? 'My payments' : 'Payment management', media: 'Gallery moderation', announcements: 'Announcements', reports: 'Reports', audit: 'Audit activity', 'mascot-library': 'Mascot library', 'neon-trail': 'Neon trail control', growth: 'Promo & sponsors', questions: 'Ask Organizer inbox', analytics: 'Analytics', attendees: 'Attendees', saved: 'Saved events', passes: 'My passes', certificates: 'Certificates', feedback: 'Feedback', calendar: 'Calendar', notifications: 'Notifications', profile: 'Profile', settings: 'Settings', 'create-event': 'Create event' };
  let content;
  if (detail) content = <Detail id={id} role={role} events={events} saved={saved} registrations={registrations} registrationRows={registrationRows} setToast={setToast} go={go} actions={actions} />;
  else if (segment === 'dashboard') content = <Dashboard role={role} events={events} saved={saved} registrations={registrations} setToast={setToast} setModal={setModal} go={go} actions={actions} theme={theme} setTheme={setTheme} />;
  else if (segment === 'discover' || segment === 'events') content = <EventBrowser role={role} events={events} saved={saved} setToast={setToast} go={go} actions={actions} />;
  else if (segment === 'create-event') content = <CreateEventForm setToast={setToast} go={go} actions={actions} />;
  else if (segment === 'passes') content = <Passes events={events} registrations={registrations} registrationRows={registrationRows} go={go} identity={identity} setToast={setToast} />;
  else if (segment === 'certificates') content = <StudentCertificates setToast={setToast} />;
  else if (segment === 'feedback') content = <StudentFeedback events={events} setToast={setToast} />;
  else if (segment === 'attendees' && role === 'organizer') content = <OrganizerOpsPanel events={events} setToast={setToast} />;
  else if (segment === 'announcements') content = <LiveAnnouncements role={role} setToast={setToast} canPublish={role === 'admin' || role === 'organizer'} />;
  else if (segment === 'categories') content = <CategoriesManager events={events} setToast={setToast} canManage={role === 'admin' || role === 'organizer'} />;
  else if (segment === 'venues') content = <VenuesManager events={events} setToast={setToast} canManage={role === 'admin' || role === 'organizer'} />;
  else if (segment === 'registrations' && role === 'admin') content = <RegistrationsDirectory events={events} setToast={setToast} scope="all" />;
  else if (segment === 'payments' && role === 'admin') content = <AdminPayments events={events} setToast={setToast} />;
  else if (segment === 'payments' && role === 'student') content = <StudentPayments setToast={setToast} go={go} events={events} />;
  else if (segment === 'media' && role === 'admin') content = <AdminMediaPage setToast={setToast} />;
  else if (segment === 'registrations' && role === 'organizer') content = <RegistrationsDirectory events={events} setToast={setToast} scope="organizer" />;
  else if (segment === 'audit') content = <AuditActivity setToast={setToast} />;
  else if (segment === 'neon-trail' && role === 'admin') content = <AdminNeonTrailControl setToast={setToast} />;
  else if (segment === 'mascot-library' && role === 'admin') content = <AdminMascotLibrary setToast={setToast} />;
  else if (segment === 'growth' && role === 'admin') content = <AdminGrowthHub setToast={setToast} />;
  else if (segment === 'questions' && role === 'organizer') content = <OrganizerQuestionsInbox events={events} setToast={setToast} />;
  else if (segment === 'calendar') content = <CalendarView events={events} registrations={registrations} go={go} />;
  else if (segment === 'settings') content = <SettingsPage role={role} theme={theme} setTheme={setTheme} setToast={setToast} identity={identity} />;
  else if (segment === 'users') content = <AdminUsersLive setToast={setToast} roleFilter="all" />;
  else if (segment === 'organizers') content = <AdminUsersLive setToast={setToast} roleFilter={ROLES.ORGANIZER} />;
  else if (segment === 'students') content = <AdminUsersLive setToast={setToast} roleFilter={ROLES.USER} />;
  else if (segment === 'notifications') content = <LiveAnnouncements role={role} setToast={setToast} canPublish={false} />;
  else if (segment === 'approvals') content = <GenericPage role={role} section="Event Approvals" events={events} setToast={setToast} go={go} actions={actions} />;
  else if (segment === 'profile') content = <><PageHead eyebrow="Your identity" title={identity.name} description="Your EventSphere profile from Supabase auth." /><div className="grid-2"><div className="surface" style={{ padding: 25, display: 'flex', gap: 17, alignItems: 'center' }}><span className="avatar" style={{ width: 64, height: 64, fontSize: 20 }}>{identity.initials}</span><div><h2 className="display" style={{ margin: 0 }}>{identity.name}</h2><p className="muted" style={{ fontSize: 12 }}>{identity.label}</p><p className="subtle" style={{ fontSize: 11 }}>{identity.email}</p></div></div><div className="surface" style={{ padding: 25 }}><div className="eyebrow">Account</div><h3 className="display" style={{ margin: '13px 0 4px' }}>{identity.label} orbit</h3><p className="muted" style={{ fontSize: 12 }}>Role is managed by campus admins.</p></div></div></>;
  else if (segment === 'saved') content = <><PageHead eyebrow="Your orbit" title="Saved events" description="A shortlist of moments you do not want to miss." />{events.filter(e => saved.includes(e.id)).length ? <div className="grid-3">{events.filter(e => saved.includes(e.id)).map(e => <EventCard key={e.id} event={e} saved onSave={async (eid) => { const { error } = await actions.toggleSave(eid); if (error) setToast(error.message); }} onOpen={(eid) => go(`/student/event/${eid}`)} role="student" onEdit={() => {}} onDelete={() => {}} onDuplicate={() => {}} onPublish={() => {}} />)}</div> : <div className="surface"><EmptyState title="Your orbit is open" message="Bookmark an event and it will wait here for you." action={<button className="btn btn-primary" onClick={() => go('/student/discover')}>Discover events</button>} /></div>}</>;
  else if (segment === 'registrations' && role === 'student') {
    content = <StudentRegistrationsPage events={events} registrations={registrations} registrationRows={registrationRows} go={go} actions={actions} setToast={setToast} path={path} refresh={refresh} />;
  }
  else content = <GenericPage role={role} section={titles[segment] || 'Operations'} events={events} setToast={setToast} go={go} actions={actions} />;
  return <Shell role={role} title={titles[segment] || 'Workspace'} theme={theme} setTheme={setTheme} onLogout={onLogout} identity={identity} events={events} registrations={registrations} setToast={setToast}>{content}{modal}</Shell>;
}
function RoleRedirect({ role }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(role ? `/${role}/dashboard` : '/login');
  }, [role, setLocation]);
  return <div className="landing"><p className="muted">Redirecting…</p></div>;
}
function AppRouter({ role, theme, setTheme, events, saved, registrations, registrationRows, setToast, onLogout, identity, authLoading, actions, dataLoading, dataError, refresh }) {
  const [path, setLocation] = useLocation();
  const { profile } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (role && (path === '/login' || path === '/signup')) {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      setLocation(resolvePostAuthPath(`/${role}/dashboard`, search));
    }
  }, [authLoading, role, path, setLocation]);

  useEffect(() => {
    if (authLoading || !role || !profile) return;
    if (profile.email_verified === false && path !== '/verify-email') {
      setLocation('/verify-email');
    }
  }, [authLoading, role, profile, path, setLocation]);

  // Let public guest routes (incl. splash on `/`) paint immediately;
  // only block private workspace paths while session is resolving.
  if (authLoading && !isPublicPath(path)) {
    return <div className="landing"><p className="muted">Loading session…</p></div>;
  }

  if (!authLoading && !role && !isPublicPath(path)) {
    return (
      <>
        <div className="landing-theme" style={{ position: 'fixed', top: 22, right: 22, zIndex: 60 }}>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
        <Login theme={theme} setTheme={setTheme} />
      </>
    );
  }

  const workspace = (expected) => {
    if (role !== expected) {
      return <RoleRedirect role={role} />;
    }
    if (dataLoading) {
      return <div className="landing"><p className="muted">Loading campus data…</p></div>;
    }
    return (
      <Workspace
        role={expected}
        events={events}
        saved={saved}
        registrations={registrations}
        registrationRows={registrationRows}
        theme={theme}
        setTheme={setTheme}
        setToast={setToast}
        onLogout={onLogout}
        identity={identity}
        actions={actions}
        refresh={refresh}
      />
    );
  };

  const showPublicTheme = isPublicPath(path);
  const themeCornerStyle =
    path === '/login' || path === '/signup' || path === '/verify-email'
      ? { position: 'fixed', top: 22, right: 22, zIndex: 60 }
      : { position: 'fixed', bottom: 22, right: 22, zIndex: 60 };

  return (
    <>
      {showPublicTheme && (
        <div className="landing-theme" style={themeCornerStyle}>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      )}
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/events" component={GuestEventsPage} />
        <Route path="/events/:id" component={GuestEventDetail} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/faq" component={FaqPage} />
        <Route path="/gallery" component={GalleryPage} />
        <Route path="/sitemap" component={SitemapPage} />
        <Route path="/login">{() => <Login theme={theme} setTheme={setTheme} />}</Route>
        <Route path="/signup" component={SignupForm} />
        <Route path="/verify-email" component={VerifyForm} />
        {/* Use /* so nested paths like /student/event/:id match ( :rest* only matches one segment ) */}
        <Route path="/admin/*">{() => workspace('admin')}</Route>
        <Route path="/organizer/*">{() => workspace('organizer')}</Route>
        <Route path="/student/*">{() => workspace('student')}</Route>
        <Route><Landing /></Route>
      </Switch>
    </>
  );
}
function App() {
  const { user, profile, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const role = user && profile ? uiRoleFromProfile(profile.role) : null;
  const identity = orbitIdentity(role || 'student', profile);
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('eventsphere_theme') || 'dark';
    if (typeof document !== 'undefined') applyThemeClass(saved);
    return saved;
  });
  const [toast, setToastState] = useState('');
  const {
    events,
    saved,
    registrations,
    registrationRows,
    loading: dataLoading,
    error: dataError,
    actions,
    refresh,
  } = useEventSphereData();

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  useEffect(() => {
    if (dataError) setToastState(dataError);
  }, [dataError]);

  const setTheme = (value, event) => {
    if (value === theme) return;
    const root = document.documentElement;
    if (root.dataset.themeBusy === '1') return;

    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;
    root.style.setProperty('--theme-x', `${x}px`);
    root.style.setProperty('--theme-y', `${y}px`);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const apply = () => {
      root.classList.remove('theme-to-dark', 'theme-to-light');
      root.classList.add(value === 'dark' ? 'theme-to-dark' : 'theme-to-light');
      applyThemeClass(value);
      flushSync(() => setThemeState(value));
    };
    const clearBusy = () => {
      root.dataset.themeBusy = '0';
      root.classList.remove('theme-to-dark', 'theme-to-light', 'theme-spectacle-active');
    };

    if (reduced) {
      apply();
      clearBusy();
      return;
    }

    root.dataset.themeBusy = '1';
    root.classList.add('theme-spectacle-active');
    playThemeSpectacle(x, y, value);

    const runSwap = () => {
      if (typeof document.startViewTransition !== 'function') {
        apply();
        window.setTimeout(clearBusy, 1100);
        return;
      }
      const transition = document.startViewTransition(apply);
      transition.finished.finally(() => {
        window.setTimeout(clearBusy, 180);
      });
    };

    // Swap at the nova peak so the wormhole hits mid-spectacle
    window.setTimeout(runSwap, 220);
  };
  const logout = async () => {
    await signOut();
    localStorage.removeItem('eventsphere_role');
    setLocation('/');
  };

  return (
    <div className={`app ${theme}`}>
      <AppRouter
        role={role}
        theme={theme}
        setTheme={setTheme}
        events={events}
        saved={saved}
        registrations={registrations}
        registrationRows={registrationRows}
        setToast={setToastState}
        onLogout={logout}
        identity={identity}
        authLoading={loading}
        actions={actions}
        dataLoading={dataLoading}
        dataError={dataError}
        refresh={refresh}
      />
      {toast && <Toast text={toast} onClose={() => setToastState('')} />}
    </div>
  );
}
function RoutedErrorBoundary({ children }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
export {
  Landing,
  Workspace,
  Login,
  Dashboard,
  EventBrowser,
  GenericPage,
  CreateEvent,
  CalendarView,
  Passes,
  SettingsPage,
};
export default function RootApp() { return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><App /></RoutedErrorBoundary></WouterRouter></QueryClientProvider>; }