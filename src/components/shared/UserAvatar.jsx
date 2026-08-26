/**
 * Shared avatar chip — photo when available, else initials.
 */
export default function UserAvatar({
  src,
  initials = 'ES',
  className = '',
  style,
  title,
  size,
}) {
  const mergedStyle = {
    ...(size ? { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.32)) } : null),
    ...style,
  }

  return (
    <span className={`avatar ${className}`.trim()} style={mergedStyle} title={title} aria-hidden={!title}>
      {src ? (
        <img className="es-avatar-img" src={src} alt="" />
      ) : (
        initials
      )}
    </span>
  )
}
