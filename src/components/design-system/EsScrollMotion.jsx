import { createContext, useContext, useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

/** Scroll container ref for framer-motion whileInView inside workspace stage. */
export const EsScrollRootContext = createContext(null)

export function useEsScrollRoot() {
  return useContext(EsScrollRootContext)
}

const REVEAL_SELECTOR = [
  '.page-head',
  '.es-page-head',
  '.section',
  '.surface',
  '.stats-card',
  '.empty',
  '.es-empty',
  '.es-role-dash__stat',
  '.es-event-card',
  '.event-card',
  '.grid-2 > *',
  '.grid-3 > *',
  '.grid-4 > *',
  '.detail-grid > *',
  '.table-wrap',
  '.chart',
  '.activity-item',
  '.pass',
  '.notification-row',
  '.es-page-head + *',
].join(', ')

function collectRevealTargets(root) {
  const nodes = [...root.querySelectorAll(REVEAL_SELECTOR)]
  return nodes.filter((el) => {
    if (el.closest('.stu-dash')) return false
    if (el.closest('[data-es-reveal-skip]')) return false
    if (el.closest('[data-es-no-reveal]')) return false
    // Never animate interactive forms / dialogs — opacity:0 + remounts break typing
    if (el.closest('.modal, .modal-backdrop, .form-grid, form, [data-testid="event-visual-fields"]'))
      return false
    if (el.querySelector?.('input, textarea, select')) return false
    if (el.matches('input, textarea, select, button, label')) return false
    if (el.classList.contains('es-scroll-reveal')) return false
    return !nodes.some((other) => other !== el && other.contains(el))
  })
}

/**
 * Lightweight scroll-reveal for all workspace pages.
 * Uses IntersectionObserver + CSS (GPU-friendly) — no per-element React motion trees.
 * Also pauses neon trail CSS while the user is scrolling (biggest FPS win).
 */
export default function EsScrollMotion({ children, scrollRef, routeKey = '' }) {
  const reduce = useReducedMotion()
  const observerRef = useRef(null)
  const debounceRef = useRef(null)
  const scrollIdleRef = useRef(null)

  useEffect(() => {
    const root = scrollRef?.current
    if (!root) return undefined

    const markScrolling = () => {
      document.documentElement.classList.add('is-scrolling')
      if (scrollIdleRef.current) window.clearTimeout(scrollIdleRef.current)
      scrollIdleRef.current = window.setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling')
      }, 140)
    }

    root.addEventListener('scroll', markScrolling, { passive: true })
    window.addEventListener('scroll', markScrolling, { passive: true })

    return () => {
      root.removeEventListener('scroll', markScrolling)
      window.removeEventListener('scroll', markScrolling)
      if (scrollIdleRef.current) window.clearTimeout(scrollIdleRef.current)
      document.documentElement.classList.remove('is-scrolling')
    }
  }, [scrollRef])

  useEffect(() => {
    const root = scrollRef?.current
    if (!root) return

    const narrow =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches

    if (reduce || narrow) {
      root.querySelectorAll('.es-scroll-reveal').forEach((el) => {
        el.classList.add('es-scroll-reveal--in')
      })
      return undefined
    }

    let stagger = 0

    const observe = (el) => {
      if (!observerRef.current) return
      el.classList.add('es-scroll-reveal')
      el.style.setProperty('--es-reveal-delay', `${Math.min(stagger * 0.04, 0.28)}s`)
      stagger += 1
      observerRef.current.observe(el)
    }

    const scan = () => {
      if (document.documentElement.classList.contains('is-scrolling')) return
      stagger = 0
      collectRevealTargets(root).forEach(observe)
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return
          target.classList.add('es-scroll-reveal--in')
          observerRef.current?.unobserve(target)
        })
      },
      { root, threshold: 0.1, rootMargin: '0px 0px -4% 0px' },
    )

    scan()

    const scheduleScan = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(scan, 280)
    }

    const mo = new MutationObserver(scheduleScan)
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
      mo.disconnect()
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [scrollRef, reduce, routeKey])

  return (
    <EsScrollRootContext.Provider value={scrollRef}>
      {children}
    </EsScrollRootContext.Provider>
  )
}
