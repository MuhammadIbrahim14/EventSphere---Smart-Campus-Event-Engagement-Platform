import { motion, useReducedMotion } from 'framer-motion'
import { useEsScrollRoot } from './EsScrollMotion'

const easeOut = [0.22, 1, 0.36, 1]
const viewportOnce = { once: true, amount: 0.22, margin: '0px 0px -8% 0px' }

/**
 * Shared scroll-reveal wrapper for EventSphere skins.
 */
export default function EsReveal({
  children,
  className = '',
  delay = 0,
  x = 0,
  y = 40,
  scale = 0.98,
  as: Tag = motion.div,
  ...rest
}) {
  const reduce = useReducedMotion()
  const scrollRoot = useEsScrollRoot()
  const viewport = reduce
    ? undefined
    : {
        ...viewportOnce,
        root: scrollRoot?.current ?? undefined,
      }

  return (
    <Tag
      className={className}
      data-es-reveal-skip
      initial={reduce ? false : { opacity: 0, x, y: Math.min(Math.abs(y), 20) * Math.sign(y || 1), scale: Math.min(scale, 0.99) }}
      whileInView={reduce ? undefined : { opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={viewport}
      transition={{ duration: 0.35, delay, ease: easeOut }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
