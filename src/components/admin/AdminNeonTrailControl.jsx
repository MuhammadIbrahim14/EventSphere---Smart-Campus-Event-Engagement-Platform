import { useEffect, useState } from 'react'
import { Check, Cloud, CloudOff, Loader2, RotateCcw, Sparkles, Zap } from 'lucide-react'
import { EsPageChrome } from '@/components/design-system'
import { useNeonTrail } from '@/context/NeonTrailContext'
import {
  NEON_TRAIL_PANELS,
  NEON_TRAIL_PANEL_LABELS,
  normalizeHex,
} from '@/lib/neonTrail'

const COLOR_LABELS = ['Lead glow', 'Peak white', 'Accent flash']

function ToggleRow({ label, hint, checked, onChange, testId }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 0',
        borderBottom: '1px solid var(--line)',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      <span>
        <strong style={{ display: 'block', fontWeight: 600 }}>{label}</strong>
        {hint ? <span className="muted" style={{ fontSize: 11 }}>{hint}</span> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
    </label>
  )
}

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

function PanelPreview({ panelKey, colors }) {
  return (
    <div
      className={`es-neon-trail-preview es-neon-trail-preview--${panelKey}`}
      aria-hidden="true"
      style={{
        '--preview-a': colors[0],
        '--preview-b': colors[1],
        '--preview-c': colors[2],
      }}
    />
  )
}

function PanelEditor({ panelKey, panel, masterEnabled, updatePanel, updatePanelColor }) {
  const label = NEON_TRAIL_PANEL_LABELS[panelKey]
  const active = masterEnabled && panel.enabled

  return (
    <div className="surface" style={{ padding: 21 }} data-testid={`neon-panel-${panelKey}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="eyebrow">{label}</div>
          <h2 className="display" style={{ margin: '8px 0 4px', fontSize: 20 }}>{label} trail</h2>
          <p className="muted" style={{ fontSize: 11, margin: 0 }}>
            {panel.duration}s · {panel.reverse ? 'reverse' : 'forward'} spin
          </p>
        </div>
        <PanelPreview panelKey={panelKey} colors={panel.colors} />
      </div>

      <ToggleRow
        label={`Show ${label.toLowerCase()} trail`}
        checked={panel.enabled}
        onChange={(enabled) => updatePanel(panelKey, { enabled })}
        testId={`neon-toggle-${panelKey}`}
      />

      <div style={{ opacity: active ? 1 : 0.45, pointerEvents: active ? 'auto' : 'none' }}>
        {COLOR_LABELS.map((colorLabel, i) => (
          <ColorField
            key={colorLabel}
            label={colorLabel}
            value={panel.colors[i]}
            onChange={(hex) => updatePanelColor(panelKey, i, hex)}
            testId={`neon-color-${panelKey}-${i}`}
          />
        ))}

        <div style={{ marginTop: 16 }}>
          <label className="label">Speed ({panel.duration}s per loop)</label>
          <input
            type="range"
            min={4}
            max={30}
            step={1}
            value={panel.duration}
            onChange={(e) => updatePanel(panelKey, { duration: Number(e.target.value) })}
            data-testid={`neon-speed-${panelKey}`}
            style={{ width: '100%', marginTop: 8 }}
          />
        </div>

        <ToggleRow
          label="Reverse direction"
          hint="Spin the trail counter-clockwise on this panel"
          checked={panel.reverse}
          onChange={(reverse) => updatePanel(panelKey, { reverse })}
          testId={`neon-reverse-${panelKey}`}
        />
      </div>
    </div>
  )
}

function SyncHint({ syncStatus, syncError }) {
  if (syncStatus === 'loading') {
    return (
      <>
        <Loader2 size={16} style={{ color: 'var(--es-ice)', animation: 'spin 0.9s linear infinite' }} />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Loading campus-wide neon trail from database…
        </p>
      </>
    )
  }
  if (syncStatus === 'saving') {
    return (
      <>
        <Cloud size={16} style={{ color: 'var(--es-ice)' }} />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Saving campus-wide theme…
        </p>
      </>
    )
  }
  if (syncStatus === 'error') {
    return (
      <>
        <CloudOff size={16} style={{ color: 'var(--danger, #e85d5d)' }} />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {syncError || 'Could not sync. Confirm SQL migration ran and you are logged in as admin.'}
        </p>
      </>
    )
  }
  if (syncStatus === 'local') {
    return (
      <>
        <Sparkles size={16} style={{ color: 'var(--es-ice)' }} />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Supabase is not configured — theme stays on this device only.
        </p>
      </>
    )
  }
  return (
    <>
      <Cloud size={16} style={{ color: 'var(--es-ice)' }} />
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Campus-wide: changes auto-save to the database and apply for every user and device.
      </p>
    </>
  )
}

export default function AdminNeonTrailControl({ setToast }) {
  const {
    config,
    setEnabled,
    updatePanel,
    updatePanelColor,
    resetDefaults,
    syncStatus,
    syncError,
    persistNow,
  } = useNeonTrail()
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const confirmSave = async () => {
    setBusy(true)
    const { error } = await persistNow()
    setBusy(false)
    if (error) {
      setToast?.(error.message || 'Could not save campus neon trail')
      return
    }
    setSaved(true)
    setToast?.('Campus neon trail saved for all users')
    window.setTimeout(() => setSaved(false), 1600)
  }

  const onReset = async () => {
    resetDefaults()
    setToast?.('Neon trails reset to defaults — saving campus-wide…')
    window.setTimeout(async () => {
      const { error } = await persistNow()
      if (error) setToast?.(error.message || 'Reset applied locally; DB save failed')
      else setToast?.('Campus neon trail reset to defaults')
    }, 80)
  }

  return (
    <>
      <EsPageChrome
        eyebrow="Platform appearance"
        title="Neon trail control"
        description="Tune the animated border trails on sidebar, header, and main stage. Changes save to the database and apply campus-wide."
        action={
          <button type="button" className="btn btn-quiet" onClick={onReset}>
            <RotateCcw size={14} /> Reset defaults
          </button>
        }
      />

      <div className="surface" style={{ padding: 21, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, var(--es-neon, #ff4fd8), var(--es-ice, #5ce1ff))',
              color: '#07060c',
            }}
          >
            <Zap size={18} />
          </span>
          <div>
            <div className="eyebrow">Master switch</div>
            <h2 className="display" style={{ margin: '4px 0 0', fontSize: 22 }}>Neon trails</h2>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 12px' }}>
          Turn all panel trails off without losing your color presets. Per-panel toggles below still apply when re-enabled.
        </p>
        <ToggleRow
          label="Enable neon trails"
          hint="Applies to sidebar, header, and main content borders for every campus user"
          checked={config.enabled}
          onChange={setEnabled}
          testId="neon-master-toggle"
        />
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {NEON_TRAIL_PANELS.map((key) => (
          <PanelEditor
            key={key}
            panelKey={key}
            panel={config.panels[key]}
            masterEnabled={config.enabled}
            updatePanel={updatePanel}
            updatePanelColor={updatePanelColor}
          />
        ))}
      </div>

      <div
        className="surface"
        style={{
          padding: 18,
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SyncHint syncStatus={syncStatus} syncError={syncError} />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={confirmSave}
          disabled={busy || syncStatus === 'loading'}
          data-testid="button-save-neon-trail"
        >
          {busy || syncStatus === 'saving' ? (
            <><Loader2 size={14} style={{ animation: 'spin 0.9s linear infinite' }} /> Saving…</>
          ) : saved ? (
            <><Check size={14} /> Saved campus-wide</>
          ) : (
            'Save campus-wide'
          )}
        </button>
      </div>
    </>
  )
}
