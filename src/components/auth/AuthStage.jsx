import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { EsBrandMark } from '@/components/design-system/EsBrandLogo'
import BrandHoldSurface from '@/components/shared/BrandHoldSurface'
import { CAMPUS_CHARACTERS } from '@/constants/campusCharacters'

const PULL_KEY = 'es_auth_pull_v2'
const MASCOT = CAMPUS_CHARACTERS.hero

function hasSeenPull() {
  try {
    return sessionStorage.getItem(PULL_KEY) === '1'
  } catch {
    return false
  }
}

function markPullSeen() {
  try {
    sessionStorage.setItem(PULL_KEY, '1')
  } catch {
    /* ignore */
  }
}

function OrbitDust({ reduce }) {
  const dots = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        top: `${(i * 53) % 100}%`,
        size: 2 + (i % 3),
        delay: (i % 7) * 0.35,
        dur: 4 + (i % 5),
      })),
    [],
  )
  if (reduce) return null
  return (
    <div className="es-auth__dust" aria-hidden>
      {dots.map((d) => (
        <span
          key={d.id}
          className="es-auth__dust-dot"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.dur}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function AuthStage({
  mode = 'login',
  mood = 'idle',
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  testId = 'auth-stage',
}) {
  const reduce = useReducedMotion()
  const [playPull, setPlayPull] = useState(() => !reduce && !hasSeenPull())
  const [ready, setReady] = useState(() => reduce || hasSeenPull())
  const [phase, setPhase] = useState(() => (reduce || hasSeenPull() ? 'settled' : 'enter'))

  useEffect(() => {
    if (!playPull) {
      setReady(true)
      setPhase('settled')
      return undefined
    }
    setPhase('pull')
    const settle = window.setTimeout(() => {
      markPullSeen()
      setPlayPull(false)
      setReady(true)
      setPhase('settled')
    }, 2100)
    return () => window.clearTimeout(settle)
  }, [playPull])

  useEffect(() => {
    const html = document.documentElement
    html.classList.add('es-auth-lock')
    const prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      html.classList.remove('es-auth-lock')
      document.body.style.overflow = prevBodyOverflow
    }
  }, [])

  const skipPull = () => {
    markPullSeen()
    setPlayPull(false)
    setReady(true)
    setPhase('settled')
  }

  const mascotVariants = {
    enter: { x: -180, opacity: 0, rotate: -12, scale: 0.92 },
    pull: {
      x: [ -180, 24, -4, 0 ],
      opacity: 1,
      rotate: [ -12, 8, -2, 0 ],
      scale: 1,
      transition: { duration: 1.55, times: [0, 0.55, 0.82, 1], ease: 'easeOut' },
    },
    settled: {
      y: [0, -6, 0],
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
    },
    error: {
      x: [0, -8, 8, -5, 5, 0],
      rotate: [0, -5, 5, -3, 0],
      transition: { duration: 0.5 },
    },
    busy: {
      y: [0, -5, 0],
      transition: { duration: 0.7, repeat: Infinity, ease: 'easeInOut' },
    },
  }

  const passVariants = {
    enter: { x: '16%', opacity: 0, rotate: 6, scale: 0.96 },
    pull: {
      x: ['16%', '-0.5%', '0%', '0%'],
      opacity: 1,
      rotate: [6, -1, 0, 0],
      scale: 1,
      transition: { duration: 1.65, delay: 0.18, times: [0, 0.62, 0.85, 1], ease: [0.16, 1, 0.3, 1] },
    },
    settled: { x: 0, opacity: 1, rotate: 0, scale: 1 },
  }

  const mascotState = reduce
    ? 'settled'
    : mood === 'error'
      ? 'error'
      : mood === 'busy'
        ? 'busy'
        : playPull
          ? 'pull'
          : phase === 'settled'
            ? 'settled'
            : 'enter'

  const passState = reduce ? 'settled' : playPull ? 'pull' : 'settled'

  const modeChip = {
    login: { href: '/signup', label: 'Need a seat? Sign up' },
    signup: { href: '/login', label: 'Have an account? Sign in' },
    verify: { href: '/login', label: 'Back to sign in' },
    forgot: { href: '/login', label: 'Back to sign in' },
  }[mode] || { href: '/login', label: 'Sign in' }

  const passCode = {
    login: 'RETURN PASS',
    signup: 'NEW PASS',
    verify: 'VERIFY PASS',
    forgot: 'RECOVERY',
  }[mode] || 'CAMPUS PASS'

  const line =
    mood === 'error'
      ? 'That didn’t lock — try again.'
      : mood === 'busy'
        ? 'Aligning your orbit…'
        : mode === 'signup'
          ? 'Grabbing your boarding pass…'
          : mode === 'verify'
            ? 'Scanning your orbit code…'
            : mode === 'forgot'
              ? 'Opening the recovery airlock…'
              : 'Hauling the gate open for you.'

  return (
    <div
      className={`es-auth es-public es-auth--${mode} es-auth--${mood}`}
      data-testid={testId}
      data-phase={phase}
    >
      <div className="es-auth__sky" aria-hidden>
        <div className="es-auth__grid" />
        <div className="es-auth__blob es-auth__blob--a" />
        <div className="es-auth__blob es-auth__blob--b" />
        <div className="es-auth__blob es-auth__blob--c" />
        <OrbitDust reduce={reduce} />
        <div className="es-auth__rings">
          <span className="es-auth__ring es-auth__ring--1" />
          <span className="es-auth__ring es-auth__ring--2" />
          <span className="es-auth__ring es-auth__ring--3" />
        </div>
      </div>

      <div className="es-auth__top">
        <BrandHoldSurface className="es-brand-logo--holdable">
          <Link href="/" className="es-auth__brand" aria-label="EventSphere home">
            <EsBrandMark cycle={0} />
            <span className="es-auth__brand-copy">
              <span className="es-auth__brand-name">EventSphere</span>
              <span className="es-auth__brand-tag">Orbital gate</span>
            </span>
          </Link>
        </BrandHoldSurface>
        <div className="es-auth__top-actions">
          {playPull ? (
            <button type="button" className="es-auth__ghost-btn" onClick={skipPull}>
              Skip intro
            </button>
          ) : null}
          <Link href={modeChip.href} className="es-auth__mode-chip">
            {modeChip.label}
          </Link>
        </div>
      </div>

      <div className="es-auth__canvas">
        <motion.aside
          className="es-auth__guide"
          initial={reduce ? false : 'enter'}
          animate={mascotState}
          variants={mascotVariants}
        >
          <div className="es-auth__guide-aura" />
          <img className="es-auth__mascot" src={MASCOT.src} alt={MASCOT.alt} draggable={false} />
          <AnimatePresence mode="wait">
            <motion.p
              key={line}
              className="es-auth__speech"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {line}
            </motion.p>
          </AnimatePresence>

          {!reduce ? (
            <svg className="es-auth__tow" viewBox="0 0 220 40" aria-hidden>
              <motion.path
                d="M4 20 C 60 4, 140 36, 216 18"
                fill="none"
                stroke="url(#esTowGrad)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeDasharray="5 7"
                animate={
                  playPull
                    ? { pathLength: [0, 1], opacity: [0, 1, 0.7] }
                    : { pathLength: 1, opacity: 0.35 }
                }
                transition={playPull ? { duration: 1.1, delay: 0.35 } : { duration: 0.4 }}
              />
              <defs>
                <linearGradient id="esTowGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#5ce1ff" />
                  <stop offset="100%" stopColor="#7dffb3" />
                </linearGradient>
              </defs>
            </svg>
          ) : null}
        </motion.aside>

        <motion.section
          className="es-auth__pass"
          initial={reduce ? false : 'enter'}
          animate={passState}
          variants={passVariants}
          style={{ pointerEvents: ready ? 'auto' : 'none' }}
        >
          <div className="es-auth__pass-sheen" aria-hidden />
          <div className="es-auth__pass-edge" aria-hidden />
          <div className="es-auth__pass-punch" aria-hidden />

          <div className="es-auth__pass-body">
            <div className="es-auth__pass-head">
              <span className="es-auth__pass-code">{passCode}</span>
              <span className="es-auth__pass-orbit">CAMPUS ORBIT · LIVE</span>
            </div>

            {eyebrow ? <div className="es-auth__kicker">{eyebrow}</div> : null}
            <AnimatePresence mode="wait">
              <motion.h1
                key={title}
                className="es-auth__headline"
                initial={reduce ? false : { opacity: 0, y: 12, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                {title}
              </motion.h1>
            </AnimatePresence>
            {subtitle ? <p className="es-auth__lede">{subtitle}</p> : null}

            <motion.div
              className="es-auth__body"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: ready ? 1 : 0.35 }}
              transition={{ delay: playPull ? 1.1 : 0, duration: 0.35 }}
            >
              {children}
            </motion.div>

            {footer ? <div className="es-auth__footer">{footer}</div> : null}
          </div>
        </motion.section>
      </div>
    </div>
  )
}
