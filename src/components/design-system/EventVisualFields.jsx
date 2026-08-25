import { listCharacterOptions, characterById, CAMPUS_CHARACTERS } from '@/constants/campusCharacters'

/**
 * Shared form fields: event banner URL + character mascot picker.
 * Used by organizer create/edit (and admin when editing events).
 * Does not touch payment / registration logic.
 */
export default function EventVisualFields({
  bannerUrl = '',
  characterKey = '',
  characterUrl = '',
  onChange,
}) {
  const options = listCharacterOptions()
  const previewChar =
    characterUrl ||
    characterById(characterKey)?.src ||
    CAMPUS_CHARACTERS.banner.src

  const set = (patch) => onChange?.(patch)

  return (
    <div className="full" style={{ display: 'grid', gap: 16 }} data-testid="event-visual-fields">
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Event visuals · design system
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 12px', lineHeight: 1.5 }}>
          Banner image shows on featured/event covers. Character mascot overlays cards (tech → robot,
          photo → camera, or pick manually). Leave Auto for category defaults.
        </p>
      </div>

      <div className="full">
        <label className="label">Banner image URL</label>
        <input
          className="input"
          type="url"
          value={bannerUrl || ''}
          onChange={(e) => set({ bannerUrl: e.target.value })}
          placeholder="https://…/event-banner.jpg"
          data-testid="input-event-banner-url"
        />
        {bannerUrl ? (
          <div
            className="es-visual-preview--banner"
            style={{ marginTop: 10, backgroundImage: `url(${bannerUrl})` }}
            aria-label="Banner preview"
          />
        ) : null}
      </div>

      <div className="full">
        <label className="label">Character mascot</label>
        <div className="es-char-picker" role="listbox" aria-label="Character mascot">
          {options.map((opt) => {
            const active = (characterKey || '') === (opt.id || '')
            return (
              <button
                key={opt.id || 'auto'}
                type="button"
                role="option"
                aria-selected={active}
                className={`es-char-option${active ? ' is-active' : ''}`}
                onClick={() => set({ characterKey: opt.id || '' })}
                data-testid={`button-character-${opt.id || 'auto'}`}
              >
                <img src={opt.src} alt="" />
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="full">
        <label className="label">Custom character URL (optional override)</label>
        <input
          className="input"
          type="url"
          value={characterUrl || ''}
          onChange={(e) => set({ characterUrl: e.target.value })}
          placeholder="https://…/custom-mascot.png (transparent PNG best)"
          data-testid="input-event-character-url"
        />
      </div>

      <div className="es-visual-preview">
        <img src={previewChar} alt="Mascot preview" />
        <div>
          <div className="eyebrow">Preview</div>
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
            {characterUrl
              ? 'Using custom character URL'
              : characterKey
                ? `Using library: ${characterById(characterKey)?.label || characterKey}`
                : 'Using Auto (category rules)'}
          </p>
        </div>
      </div>
    </div>
  )
}
