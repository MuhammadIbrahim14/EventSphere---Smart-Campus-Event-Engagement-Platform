import { motion, useReducedMotion } from 'framer-motion'
import { characterForEvent, CAMPUS_CHARACTERS } from '@/constants/campusCharacters'

/**
 * Decorative campus character. Pure presentation — no business logic.
 */
export default function EsCharacter({
  characterId,
  event,
  src,
  alt = '',
  className = '',
  float = false,
  ...rest
}) {
  const reduce = useReducedMotion()
  const resolved =
    src ||
    (event ? characterForEvent(event).src : null) ||
    CAMPUS_CHARACTERS[characterId]?.src ||
    CAMPUS_CHARACTERS.banner.src

  const Comp = float && !reduce ? motion.img : 'img'
  const motionProps =
    float && !reduce
      ? {
          animate: { y: [0, -8, 0] },
          transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
        }
      : {}

  return (
    <Comp
      className={`es-char ${className}`.trim()}
      src={resolved}
      alt={alt}
      draggable={false}
      {...motionProps}
      {...rest}
    />
  )
}
