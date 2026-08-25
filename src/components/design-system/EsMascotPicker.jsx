/**
 * Compact curated mascot picker — shared design system primitive.
 */
export default function EsMascotPicker({
  options = [],
  value,
  onChange,
  size = 'md',
  ariaLabel = 'Choose mascot',
  testIdPrefix = 'mascot',
}) {
  return (
    <div
      className={`es-char-picker es-mascot-picker es-mascot-picker--${size}`}
      role="listbox"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            role="option"
            aria-selected={active}
            className={`es-char-option${active ? ' is-active' : ''}`}
            onClick={() => onChange?.(opt.id)}
            data-testid={`${testIdPrefix}-${opt.id}`}
          >
            <img src={opt.src} alt="" draggable={false} />
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
