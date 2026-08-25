/**
 * Student-only dashboard redesign (Gen-Z / grain / sketch / neon).
 * Layout + scroll-reveal polish. Fonts/colors preserved.
 * Does not alter admin/organizer dashboards or registration logic.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useSpring,
} from 'framer-motion'
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  ChevronRight,
  Moon,
  Radio,
  Sparkles,
  Sun,
  Ticket,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  formatEventSchedule,
  getEventPhase,
  minutesUntilStart,
  todayLocalDate,
} from '@/lib/eventDate'
import { CAMPUS_CHARACTERS, characterForEvent, bannerForEvent } from '@/constants/campusCharacters'
import { useStudentMascot } from '@/hooks/useStudentMascot'
import StudentMascotChip from '@/components/student/StudentMascotChip'
import './student-dashboard.css'

const spring = { type: 'spring', stiffness: 280, damping: 22 }
const easeOut = [0.22, 1, 0.36, 1]

const viewportOnce = { once: true, amount: 0.22, margin: '0px 0px -8% 0px' }

function Reveal({
  children,
  className = '',
  delay = 0,
  x = 0,
  y = 40,
  scale = 0.98,
  reduce,
  as: Tag = motion.div,
  ...rest
}) {
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, x, y, scale }}
      whileInView={reduce ? undefined : { opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={reduce ? undefined : viewportOnce}
      transition={{ duration: 0.7, delay, ease: easeOut }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

function firstName(profile, user) {
  const raw = profile?.full_name || user?.email?.split('@')[0] || 'Explorer'
  return String(raw).trim().split(/\s+/)[0]
}

export default function StudentDashboard({
  events = [],
  saved = [],
  registrations = [],
  setToast,
  go,
  actions,
  theme = 'dark',
  setTheme,
}) {
  const { user, profile } = useAuth()
  const {
    pref,
    heroMascot,
    update,
    pickLibrary,
    pickCustom,
    ready: mascotReady,
    syncing,
    settings: mascotSettings,
    library: mascotLibrary,
    userId,
  } = useStudentMascot()
  const heroCharClass =
    pref.source === 'custom' ? 'hero' : pref.mascotId || 'hero'
  const reduce = useReducedMotion()
  const name = firstName(profile, user)
  const mode = theme === 'light' ? 'light' : 'dark'
  const rootRef = useRef(null)
  const stageRef = useRef(null)

  useLayoutEffect(() => {
    stageRef.current = rootRef.current?.closest('.es-stage__scroll') ?? null
  }, [])

  const { scrollYProgress } = useScroll({
    target: rootRef,
    container: stageRef,
    offset: ['start start', 'end end'],
  })
  const progressSmooth = useSpring(scrollYProgress, { stiffness: 120, damping: 28 })
  const orbParallaxA = useTransform(scrollYProgress, [0, 1], [0, -120])
  const orbParallaxB = useTransform(scrollYProgress, [0, 1], [0, 90])
  const heroShift = useTransform(scrollYProgress, [0, 0.35], [0, -48])

  const regSet = useMemo(() => new Set((registrations || []).map(String)), [registrations])

  const approved = useMemo(
    () => (events || []).filter((e) => e.status === 'Approved'),
    [events],
  )
  const mine = useMemo(
    () => approved.filter((e) => regSet.has(String(e.id))),
    [approved, regSet],
  )
  const live = mine.filter((e) => getEventPhase(e) === 'live')
  const soon = mine.filter((e) => getEventPhase(e) === 'starting_soon')
  const todayUpcoming = mine.filter(
    (e) => getEventPhase(e) === 'upcoming' && String(e.date).slice(0, 10) === todayLocalDate(),
  )
  const featured = approved[0] || null
  const orbit = approved.slice(0, 6)

  const stats = [
    {
      label: 'Registered',
      value: String(registrations?.length || 0),
      foot: 'your seats',
      icon: Ticket,
      tint: 'var(--sd-ice)',
    },
    {
      label: 'Saved',
      value: String(saved.length),
      foot: 'later vibes',
      icon: Bookmark,
      tint: 'var(--sd-hot)',
    },
    {
      label: 'Campus live',
      value: String(approved.length),
      foot: 'open moments',
      icon: Sparkles,
      tint: 'var(--sd-neon)',
    },
    {
      label: 'This week',
      value: String(
        mine.filter((e) => {
          const d = String(e.date || '')
          return d >= todayLocalDate()
        }).length,
      ),
      foot: 'on your radar',
      icon: CalendarDays,
      tint: 'var(--sd-sun)',
    },
  ]

  const signals = (orbit.length ? orbit : approved.slice(0, 4)).slice(0, 5).map((e, i) => ({
    id: e.id,
    title: `${e.title} · ${e.status}`,
    time: e.date || 'soon',
    color: i % 3 === 0 ? 'var(--sd-hot)' : i % 3 === 1 ? 'var(--sd-ice)' : 'var(--sd-neon)',
  }))

  const hoverLift = reduce
    ? {}
    : { whileHover: { y: -5, scale: 1.015 }, whileTap: { scale: 0.985 }, transition: spring }

  const toggleTheme = (e) => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setTheme?.(next, e)
  }

  const pulseItems = [
    ...live.slice(0, 2).map((e) => ({ kind: 'live', e })),
    ...soon.slice(0, 2).map((e) => ({ kind: 'soon', e })),
    ...todayUpcoming.slice(0, 1).map((e) => ({ kind: 'today', e })),
  ]

  return (
    <section
      ref={rootRef}
      className={`stu-dash stu-dash--${mode}`}
      data-theme={mode}
      data-testid="student-dashboard-v2"
      aria-label="Student dashboard"
    >
      {!reduce && (
        <motion.div
          className="stu-dash__scroll-progress"
          style={{ scaleX: progressSmooth }}
          aria-hidden="true"
        />
      )}

      <div className="stu-dash__grain" aria-hidden="true" />
      <div className="stu-dash__halftone" aria-hidden="true" />

      {!reduce && (
        <>
          <motion.div
            className="stu-dash__orb stu-dash__orb--a"
            aria-hidden="true"
            style={{ y: orbParallaxA }}
            animate={{ x: [0, 18, -8, 0], scale: [1, 1.08, 0.96, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="stu-dash__orb stu-dash__orb--b"
            aria-hidden="true"
            style={{ y: orbParallaxB }}
            animate={{ x: [0, -14, 12, 0], scale: [1, 0.94, 1.1, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
          />
          <motion.div
            className="stu-dash__orb stu-dash__orb--c"
            aria-hidden="true"
            animate={{ x: [0, 10, -16, 0], y: [0, -12, 14, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          />
        </>
      )}

      <div className="stu-dash__inner">
        <div className="stu-dash__toolbar">
          <p className="stu-dash__mode-pill" aria-live="polite">
            <span className="stu-dash__live-dot" />
            {mode === 'dark' ? 'Midnight frame' : 'Dawn frame'} · scroll the story
          </p>
          {typeof setTheme === 'function' && (
            <motion.button
              type="button"
              className="stu-dash__btn stu-dash__btn--ghost stu-dash__theme-btn"
              onClick={toggleTheme}
              whileTap={reduce ? undefined : { scale: 0.92, rotate: -12 }}
              whileHover={reduce ? undefined : { scale: 1.04 }}
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              data-testid="button-student-dash-theme"
            >
              {mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              {mode === 'dark' ? 'Try light' : 'Try midnight'}
            </motion.button>
          )}
        </div>

        {!reduce && (
          <div className="stu-dash__ticker" aria-hidden="true">
            <div className="stu-dash__ticker-track">
              <span>EVENTSPHERE · STUDENT ORBIT · SCROLL · GRAIN · SKETCH · NEON · LIVE PASSES · </span>
              <span>EVENTSPHERE · STUDENT ORBIT · SCROLL · GRAIN · SKETCH · NEON · LIVE PASSES · </span>
            </div>
          </div>
        )}

        {/* ---- HERO: one editorial composition ---- */}
        <motion.div className="stu-dash__hero" style={reduce ? undefined : { y: heroShift }}>
          <Reveal className="stu-dash__panel stu-dash__hero-main" reduce={reduce} y={36}>
            <StudentMascotChip
              pref={pref}
              heroMascot={heroMascot}
              library={mascotLibrary}
              settings={mascotSettings}
              pickLibrary={pickLibrary}
              pickCustom={pickCustom}
              update={update}
              ready={mascotReady}
              syncing={syncing}
              userId={userId}
              setToast={setToast}
            />
            <motion.img
              className={`stu-dash__char stu-dash__char--hero stu-dash__char--${heroCharClass}`}
              src={heroMascot.src}
              alt=""
              aria-hidden="true"
              draggable={false}
              key={heroMascot.src}
              initial={reduce ? false : { opacity: 0, x: 40, y: 20 }}
              animate={
                reduce
                  ? undefined
                  : { opacity: 1, x: 0, y: [0, -8, 0] }
              }
              transition={
                reduce
                  ? undefined
                  : {
                      opacity: { duration: 0.7 },
                      x: { duration: 0.7 },
                      y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
                    }
              }
            />
            {pref.showAccent ? (
              <motion.img
                className="stu-dash__char stu-dash__char--plane"
                src={CAMPUS_CHARACTERS.plane.src}
                alt=""
                aria-hidden="true"
                draggable={false}
                animate={reduce ? undefined : { y: [0, -6, 0], rotate: [-8, -2, -8] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            ) : null}
            <motion.span
              className="stu-dash__sketch"
              style={{ top: 18, left: 22 }}
              animate={reduce ? undefined : { rotate: [-10, -4, -10], y: [0, -4, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              main character energy
            </motion.span>
            <p className="stu-dash__kicker">01 · EventSphere · student orbit</p>
            <h1 className="stu-dash__title">
              Hey {name}, <span className="stu-dash__title-gradient">drop into campus</span>
            </h1>
            <p className="stu-dash__lede">
              One frame. Your seats, passes, and next plot twist — scroll down and the campus
              story unfolds.
            </p>
            <div className="stu-dash__cta-row">
              <motion.button
                type="button"
                className="stu-dash__btn stu-dash__btn--primary"
                onClick={() => go('/student/discover')}
                data-testid="button-primary-head"
                whileHover={reduce ? undefined : { scale: 1.05, y: -2 }}
                whileTap={reduce ? undefined : { scale: 0.96 }}
              >
                Explore events <ArrowRight size={15} />
              </motion.button>
              <motion.button
                type="button"
                className="stu-dash__btn stu-dash__btn--ghost"
                onClick={() => go('/student/passes')}
                whileHover={reduce ? undefined : { scale: 1.04 }}
                whileTap={reduce ? undefined : { scale: 0.96 }}
              >
                <Zap size={14} /> Open passes
              </motion.button>
              <motion.button
                type="button"
                className="stu-dash__btn stu-dash__btn--ghost"
                onClick={() => go('/student/calendar')}
                whileHover={reduce ? undefined : { scale: 1.04 }}
                whileTap={reduce ? undefined : { scale: 0.96 }}
              >
                Calendar
              </motion.button>
            </div>
          </Reveal>

          <Reveal
            className="stu-dash__panel stu-dash__hero-side"
            reduce={reduce}
            delay={0.12}
            x={28}
            y={24}
            aria-label="Live schedule pulse"
          >
            <p className="stu-dash__kicker" style={{ marginBottom: 4 }}>
              schedule pulse
            </p>
            {!pulseItems.length && (
              <div className="stu-dash__pulse">
                <div className="stu-dash__kicker" style={{ color: 'var(--sd-neon)' }}>
                  <Radio size={12} /> Quiet airwaves
                </div>
                <h3>Nothing live on your list</h3>
                <p>Discover something loud — or save a night for later.</p>
                <button
                  type="button"
                  className="stu-dash__btn stu-dash__btn--ghost"
                  style={{ marginTop: 10 }}
                  onClick={() => go('/student/discover')}
                >
                  Find a moment
                </button>
              </div>
            )}
            {pulseItems.map(({ kind, e }) => {
              if (kind === 'live') {
                return (
                  <motion.div
                    key={`live-${e.id}`}
                    className="stu-dash__pulse stu-dash__pulse--live"
                    animate={
                      reduce
                        ? undefined
                        : {
                            boxShadow: [
                              '0 0 0 rgba(125,255,179,0)',
                              '0 0 24px rgba(125,255,179,.35)',
                              '0 0 0 rgba(125,255,179,0)',
                            ],
                          }
                    }
                    transition={{ duration: 2.4, repeat: Infinity }}
                  >
                    <div className="stu-dash__kicker" style={{ color: 'var(--sd-neon)' }}>
                      <Radio size={12} className="stu-dash__spin-slow" /> Live now
                    </div>
                    <h3>{e.title}</h3>
                    <p>
                      {formatEventSchedule(e)} · {e.venue}
                    </p>
                    <button
                      type="button"
                      className="stu-dash__btn stu-dash__btn--primary"
                      style={{ marginTop: 10, padding: '8px 14px' }}
                      onClick={() => go(`/student/event/${e.id}`)}
                    >
                      Open pass
                    </button>
                  </motion.div>
                )
              }
              if (kind === 'soon') {
                const mins = minutesUntilStart(e)
                return (
                  <div key={`soon-${e.id}`} className="stu-dash__pulse stu-dash__pulse--soon">
                    <div className="stu-dash__kicker">Starting soon</div>
                    <h3>{e.title}</h3>
                    <p>
                      in {mins != null && mins > 0 ? `${mins} min` : 'a moment'} · {e.venue}
                    </p>
                    <button
                      type="button"
                      className="stu-dash__btn stu-dash__btn--ghost"
                      style={{ marginTop: 10, padding: '8px 14px' }}
                      onClick={() => go(`/student/event/${e.id}`)}
                    >
                      Details
                    </button>
                  </div>
                )
              }
              return (
                <div key={`today-${e.id}`} className="stu-dash__pulse stu-dash__pulse--hot">
                  <div className="stu-dash__kicker" style={{ color: 'var(--sd-hot)' }}>
                    Today
                  </div>
                  <h3>{e.title}</h3>
                  <p>
                    {formatEventSchedule(e)} · {e.venue}
                  </p>
                </div>
              )
            })}
          </Reveal>
        </motion.div>

        {/* ---- STATS strip (scroll reveal) ---- */}
        <Reveal className="stu-dash__section-label" reduce={reduce} y={20}>
          <span>02 · your numbers</span>
          <span className="stu-dash__section-rule" />
        </Reveal>

        <div className="stu-dash__stats">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <Reveal
                key={s.label}
                className="stu-dash__panel stu-dash__stat"
                reduce={reduce}
                delay={i * 0.08}
                y={48}
                {...hoverLift}
                data-testid={`stat-${s.label.toLowerCase().replaceAll(' ', '-')}`}
              >
                <div className="stu-dash__stat-label">
                  <span>{s.label}</span>
                  <motion.span
                    animate={reduce ? undefined : { rotate: [0, 12, -8, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Icon size={14} style={{ color: s.tint }} />
                  </motion.span>
                </div>
                <div className="stu-dash__stat-value" style={{ color: s.tint }}>
                  {s.value}
                </div>
                <div className="stu-dash__stat-foot">{s.foot}</div>
              </Reveal>
            )
          })}
        </div>

        {/* ---- FEATURED + JUMPS bento ---- */}
        <Reveal className="stu-dash__section-label" reduce={reduce} y={20}>
          <span>03 · featured frame</span>
          <span className="stu-dash__section-rule" />
        </Reveal>

        <div className="stu-dash__stage">
          <Reveal
            className="stu-dash__panel stu-dash__featured"
            reduce={reduce}
            y={56}
            scale={0.96}
            {...hoverLift}
          >
            {featured ? (
              <div
                className="stu-dash__featured-art"
                style={
                  bannerForEvent(featured)
                    ? {
                        backgroundImage: `linear-gradient(120deg, rgba(7,6,12,.72), rgba(7,6,12,.35)), url(${bannerForEvent(featured)})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
              >
                <div className="stu-dash__shimmer" aria-hidden="true" />
                <span className="stu-dash__sketch" style={{ top: 16, left: 18, color: 'var(--sd-ice)' }}>
                  featured frame
                </span>
                <motion.img
                  className="stu-dash__char stu-dash__char--banner"
                  src={characterForEvent(featured).src}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  initial={reduce ? false : { opacity: 0, x: 48, scale: 0.92 }}
                  whileInView={reduce ? undefined : { opacity: 1, x: 0, scale: 1 }}
                  viewport={viewportOnce}
                  animate={reduce ? undefined : { y: [0, -10, 0] }}
                  transition={{
                    opacity: { duration: 0.75 },
                    x: { duration: 0.75 },
                    scale: { duration: 0.75 },
                    y: { duration: 4.8, repeat: Infinity, ease: 'easeInOut' },
                  }}
                />
                <motion.div
                  className="stu-dash__manga"
                  aria-hidden="true"
                  animate={reduce ? undefined : { x: [0, 8, 0], opacity: [0.08, 0.14, 0.08] }}
                  transition={{ duration: 6, repeat: Infinity }}
                >
                  {String(featured.symbol || featured.title || 'ES')
                    .slice(0, 2)
                    .toUpperCase()}
                </motion.div>
                <div className="stu-dash__featured-body" style={{ position: 'relative', zIndex: 2 }}>
                  <p className="stu-dash__kicker">
                    featured · {featured.category || 'Campus'}
                  </p>
                  <h2>{featured.title}</h2>
                  <p>{featured.description || 'A campus moment worth showing up for.'}</p>
                  <motion.button
                    type="button"
                    className="stu-dash__btn stu-dash__btn--primary"
                    onClick={() => go(`/student/event/${featured.id}`)}
                    data-testid="button-featured-event"
                    whileHover={reduce ? undefined : { scale: 1.05, x: 4 }}
                    whileTap={reduce ? undefined : { scale: 0.96 }}
                  >
                    Enter the frame <ArrowRight size={14} />
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="stu-dash__featured-body">
                <p className="stu-dash__kicker">empty frame</p>
                <h2>No approved events yet</h2>
                <p>When campus publishes, it drops here first.</p>
              </div>
            )}
          </Reveal>

          <div className="stu-dash__jumps">
            <Reveal className="stu-dash__panel stu-dash__jump" reduce={reduce} delay={0.08} x={24} y={32}>
              <p className="stu-dash__kicker">quick jump</p>
              <h3>Passes wallet</h3>
              <p>QR-ready tickets for check-in night.</p>
              <button type="button" className="stu-dash__btn stu-dash__btn--ghost" onClick={() => go('/student/passes')}>
                Open <ArrowRight size={13} />
              </button>
            </Reveal>
            <Reveal className="stu-dash__panel stu-dash__jump" reduce={reduce} delay={0.16} x={24} y={32}>
              <p className="stu-dash__kicker">quick jump</p>
              <h3>My registrations</h3>
              <p>Seats, fees, deposits — all in one lane.</p>
              <button
                type="button"
                className="stu-dash__btn stu-dash__btn--ghost"
                onClick={() => go('/student/registrations')}
              >
                Open <ArrowRight size={13} />
              </button>
            </Reveal>
            <Reveal className="stu-dash__panel stu-dash__jump" reduce={reduce} delay={0.24} x={24} y={32}>
              <p className="stu-dash__kicker">quick jump</p>
              <h3>Certificates</h3>
              <p>Download wins after the show ends.</p>
              <button
                type="button"
                className="stu-dash__btn stu-dash__btn--ghost"
                onClick={() => go('/student/certificates')}
              >
                Open <ArrowRight size={13} />
              </button>
            </Reveal>
          </div>
        </div>

        {/* ---- HORIZONTAL ORBIT (scroll-driven feel) ---- */}
        <Reveal className="stu-dash__section-label" reduce={reduce} y={20}>
          <span>04 · orbit carousel</span>
          <span className="stu-dash__section-rule" />
          <button
            type="button"
            className="stu-dash__linkish"
            onClick={() => go('/student/discover')}
            data-testid="button-view-all"
          >
            View all <ChevronRight size={12} />
          </button>
        </Reveal>

        <div className="stu-dash__orbit-wrap">
          <div className="stu-dash__orbit-track" role="list">
            {orbit.length ? (
              orbit.map((e, i) => {
                const mascot = characterForEvent(e)
                return (
                <Reveal
                  key={e.id}
                  role="listitem"
                  className="stu-dash__panel stu-dash__orbit-card"
                  reduce={reduce}
                  delay={i * 0.07}
                  x={56}
                  y={24}
                  {...hoverLift}
                  tabIndex={0}
                  onClick={() => go(`/student/event/${e.id}`)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      go(`/student/event/${e.id}`)
                    }
                  }}
                >
                  <div className="stu-dash__orbit-thumb">
                    <img
                      className="stu-dash__char stu-dash__char--card"
                      src={mascot.src}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                  </div>
                  <div className="stu-dash__orbit-copy">
                    <span className="stu-dash__orbit-tag">{e.category || mascot.label}</span>
                    <h3>{e.title}</h3>
                    <p>
                      {e.date || 'TBA'} · {e.venue || 'Campus'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="stu-dash__btn stu-dash__btn--ghost stu-dash__orbit-save"
                    aria-label={saved.includes(e.id) ? 'Unsave event' : 'Save event'}
                    onClick={async (ev) => {
                      ev.stopPropagation()
                      const { saved: nowSaved, error } = await actions.toggleSave(e.id)
                      setToast?.(
                        error
                          ? error.message
                          : nowSaved
                            ? 'Saved to your orbit'
                            : 'Removed from saved events',
                      )
                    }}
                  >
                    <Bookmark size={14} fill={saved.includes(e.id) ? 'currentColor' : 'none'} />
                  </button>
                </Reveal>
                )
              })
            ) : (
              <div className="stu-dash__panel stu-dash__orbit-empty">
                <p className="stu-dash__lede" style={{ margin: 0 }}>
                  Orbit empty — discover an event and bookmark it.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ---- SIGNALS timeline ---- */}
        <Reveal className="stu-dash__section-label" reduce={reduce} y={20}>
          <span>05 · signals</span>
          <span className="stu-dash__section-rule" />
        </Reveal>

        <Reveal className="stu-dash__panel stu-dash__signals" reduce={reduce} y={40}>
          <h2>Signals from your orbit</h2>
          {signals.length ? (
            signals.map((s, i) => (
              <Reveal
                key={s.id}
                className="stu-dash__signal-row"
                reduce={reduce}
                delay={0.05 + i * 0.07}
                x={-20}
                y={12}
                scale={1}
              >
                <motion.span
                  className="stu-dash__dot"
                  style={{ color: s.color, background: s.color }}
                  animate={reduce ? undefined : { scale: [1, 1.35, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.3 }}
                />
                <div>
                  <p>{s.title}</p>
                  <time>{s.time}</time>
                </div>
              </Reveal>
            ))
          ) : (
            <div className="stu-dash__signal-row">
              <span
                className="stu-dash__dot"
                style={{ color: 'var(--sd-hot)', background: 'var(--sd-hot)' }}
              />
              <div>
                <p>No events yet — discover to light up this feed</p>
                <time>live</time>
              </div>
            </div>
          )}
        </Reveal>

        {/* ---- CLOSING CTA band ---- */}
        <Reveal className="stu-dash__panel stu-dash__finale" reduce={reduce} y={50} scale={0.97}>
          <div>
            <p className="stu-dash__kicker">end card</p>
            <h2>Still scrolling? Campus is waiting.</h2>
            <p className="stu-dash__lede" style={{ marginBottom: 0 }}>
              Discover something loud, save it, register, then flash the pass.
            </p>
          </div>
          <motion.button
            type="button"
            className="stu-dash__btn stu-dash__btn--primary"
            onClick={() => go('/student/discover')}
            whileHover={reduce ? undefined : { scale: 1.05, y: -2 }}
            whileTap={reduce ? undefined : { scale: 0.96 }}
          >
            Go discover <ArrowRight size={15} />
          </motion.button>
        </Reveal>
      </div>
    </section>
  )
}
