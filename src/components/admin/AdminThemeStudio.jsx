import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  Palette,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { EsPageChrome } from '@/components/design-system'
import { useThemeEngine } from '@/context/ThemeEngineContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  THEME_FIELD_GROUPS,
  THEME_PALETTE_LABELS,
  THEME_PRESETS,
  normalizeHex,
  paletteContrastWarnings,
} from '@/lib/themeEngine'

function ColorField({ label, value, onChange, testId }) {
  const [text, setText] = useState(value)

  useEffect(() => {
    setText(value)
  }, [value])

  const commit = (raw) => {
    const next = normalizeHex(raw, value)
    setText(next)
    onChange(next)
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => commit(e.target.value)}
          aria-label={`${label} picker`}
          data-testid={`${testId}-picker`}
          style={{
            width: 42,
            height: 36,
            padding: 2,
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--panel)',
            cursor: 'pointer',
          }}
        />
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(text)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(text)
          }}
          placeholder="#5ce1ff"
          spellCheck={false}
          data-testid={`${testId}-hex`}
          style={{ flex: 1, fontFamily: 'var(--es-mono, monospace)', fontSize: 12 }}
        />
      </div>
    </div>
  )
}

function SyncHint({ syncStatus, syncError }) {
  if (!isSupabaseConfigured) {
    return (
      <>
        <CloudOff size={16} style={{ color: 'var(--es-sun)' }} />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Supabase is not configured — theme stays on this device only.
        </p>
      </>
    )
  }
  if (syncStatus === 'loading') {
    return (
      <>
        <Loader2 size={16} style={{ animation: 'spin 0.9s linear infinite' }} />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>Loading campus theme…</p>
      </>
    )
  }
  if (syncStatus === 'error') {
    return (
      <>
        <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {syncError || 'Sync error'} — edits still preview locally.
        </p>
      </>
    )
  }
  if (syncStatus === 'saving') {
    return (
      <>
        <Loader2 size={16} style={{ animation: 'spin 0.9s linear infinite' }} />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>Saving campus theme…</p>
      </>
    )
  }
  return (
    <>
      <Cloud size={16} style={{ color: 'var(--es-ice)' }} />
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Campus-wide: colors save to the database and apply for every user and device.
        User light/dark toggle still works — both modes are admin-owned.
      </p>
    </>
  )
}

function StagePreview({ palette }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 88,
        borderRadius: 16,
        border: '1px solid var(--line)',
        overflow: 'hidden',
        background: `
          radial-gradient(420px 120px at 12% -20%, ${palette.orbA}55, transparent 55%),
          radial-gradient(360px 120px at 95% 0%, ${palette.orbB}44, transparent 50%),
          radial-gradient(280px 100px at 50% 120%, ${palette.orbC}33, transparent 55%),
          linear-gradient(165deg, ${palette.stageFrom} 0%, ${palette.stageMid} 48%, ${palette.stageTo} 100%)
        `,
        display: 'flex',
        alignItems: 'flex-end',
        padding: 12,
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '6px 12px',
          borderRadius: 999,
          background: `linear-gradient(100deg, ${palette.btnFrom}, ${palette.btnTo})`,
          color: palette.btnText,
        }}
      >
        Primary
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: palette.text }}>Aa</span>
      <span style={{ fontSize: 10, color: palette.muted }}>muted</span>
    </div>
  )
}

export default function AdminThemeStudio({ setToast }) {
  const {
    config,
    updatePaletteColor,
    applyPreset,
    resetDefaults,
    syncStatus,
    syncError,
    persistNow,
  } = useThemeEngine()
  const [mode, setMode] = useState('dark')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const palette = config[mode] || config.dark
  const warnings = useMemo(() => paletteContrastWarnings(palette), [palette])

  const confirmSave = async () => {
    setBusy(true)
    const { error } = await persistNow()
    setBusy(false)
    if (error) {
      setToast?.(error.message || 'Could not save campus theme')
      return
    }
    setSaved(true)
    setToast?.('Campus theme saved for all users')
    window.setTimeout(() => setSaved(false), 1600)
  }

  const onReset = async () => {
    resetDefaults()
    setToast?.('Theme reset to Midnight Campus — saving…')
    window.setTimeout(async () => {
      const { error } = await persistNow()
      if (error) setToast?.(error.message || 'Reset local; DB save failed')
      else setToast?.('Campus theme reset to defaults')
    }, 80)
  }

  return (
    <>
      <EsPageChrome
        eyebrow="Platform appearance"
        title="Theme studio"
        description="Control the shared EventSphere color system — stage glows, brand accents, and primary buttons. Both dark and light modes are stored campus-wide."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-quiet" onClick={onReset} data-testid="button-theme-reset">
              <RotateCcw size={14} /> Reset defaults
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || syncStatus === 'saving'}
              onClick={confirmSave}
              data-testid="button-theme-save"
            >
              {busy || syncStatus === 'saving' ? (
                <Loader2 size={14} style={{ animation: 'spin 0.9s linear infinite' }} />
              ) : saved ? (
                <Check size={14} />
              ) : (
                <Palette size={14} />
              )}
              {saved ? 'Saved' : 'Save to campus'}
            </button>
          </div>
        }
      />

      <div className="surface" style={{ padding: 21, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, var(--es-hot), var(--es-ice))',
              color: '#07060c',
            }}
          >
            <Sparkles size={18} />
          </span>
          <SyncHint syncStatus={syncStatus} syncError={syncError} />
        </div>
      </div>

      <div className="surface" style={{ padding: 21, marginBottom: 16 }}>
        <div className="eyebrow">Presets</div>
        <h2 className="display" style={{ margin: '8px 0 12px', fontSize: 20 }}>Start from a pack</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.values(THEME_PRESETS).map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip ${config.preset === p.id ? 'active' : ''}`}
              onClick={() => {
                applyPreset(p.id)
                setToast?.(`Applied ${p.label}`)
              }}
              data-testid={`button-theme-preset-${p.id}`}
            >
              {p.label}
            </button>
          ))}
          {config.preset === 'custom' ? <span className="chip active">Custom</span> : null}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          className={`chip ${mode === 'dark' ? 'active' : ''}`}
          onClick={() => setMode('dark')}
          data-testid="button-theme-mode-dark"
        >
          Edit dark mode
        </button>
        <button
          type="button"
          className={`chip ${mode === 'light' ? 'active' : ''}`}
          onClick={() => setMode('light')}
          data-testid="button-theme-mode-light"
        >
          Edit light mode
        </button>
      </div>

      <div className="surface" style={{ padding: 21, marginBottom: 16 }}>
        <div className="eyebrow">Live preview · {mode}</div>
        <h2 className="display" style={{ margin: '8px 0 12px', fontSize: 18 }}>Stage + button</h2>
        <StagePreview palette={palette} />
        {warnings.length ? (
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 11, color: 'var(--danger)' }}>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
            Contrast looks OK for text and primary button on this mode.
          </p>
        )}
      </div>

      <div className="grid-2" style={{ gap: 16 }}>
        {THEME_FIELD_GROUPS.map((group) => (
          <div key={group.id} className="surface" style={{ padding: 21 }}>
            <div className="eyebrow">{group.title}</div>
            <h2 className="display" style={{ margin: '8px 0 14px', fontSize: 18 }}>{group.title}</h2>
            <div className="form-grid">
              {group.keys.map((key) => (
                <div key={key} className="full">
                  <ColorField
                    label={THEME_PALETTE_LABELS[key] || key}
                    value={palette[key]}
                    onChange={(hex) => updatePaletteColor(mode, key, hex)}
                    testId={`theme-${mode}-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
