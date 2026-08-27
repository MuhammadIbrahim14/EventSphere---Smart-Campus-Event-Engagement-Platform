import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { listVenueMaps } from '@/services/experience'

const PIN_COLORS = {
  stall: '#5ce1ff',
  food: '#7dffb3',
  exit: '#ff4fd8',
  stage: '#ffd166',
  restroom: '#aab0c8',
  info: '#9a7bff',
}

export default function VenueMapViewer({ eventId, venueId }) {
  const [maps, setMaps] = useState([])
  const [active, setActive] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await listVenueMaps({ eventId, venueId })
      if (!alive) return
      setMaps(data || [])
      setActive(data?.[0] || null)
    })()
    return () => {
      alive = false
    }
  }, [eventId, venueId])

  if (!maps.length || !active) return null

  const pins = active.venue_map_pins || []

  return (
    <div className="surface" style={{ padding: 18, marginTop: 16 }} data-testid="venue-map">
      <div className="eyebrow">Indoor navigation</div>
      <h3 className="display" style={{ margin: '8px 0 12px', fontSize: 20 }}>{active.title}</h3>
      {maps.length > 1 ? (
        <div className="chips" style={{ marginBottom: 12 }}>
          {maps.map((m) => (
            <button key={m.id} type="button" className={`chip ${active.id === m.id ? 'active' : ''}`} onClick={() => setActive(m)}>
              {m.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="es-venue-map">
        <img src={active.image_url} alt={active.title} className="es-venue-map__img" />
        {pins.map((p) => (
          <button
            key={p.id}
            type="button"
            className="es-venue-map__pin"
            style={{
              left: `${p.x_pct}%`,
              top: `${p.y_pct}%`,
              '--pin-color': PIN_COLORS[p.pin_type] || PIN_COLORS.info,
            }}
            title={`${p.label} (${p.pin_type})`}
          >
            <MapPin size={14} />
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      <ul className="es-venue-map__legend">
        {pins.map((p) => (
          <li key={`leg-${p.id}`}>
            <span style={{ color: PIN_COLORS[p.pin_type] || '#fff' }}>●</span> {p.label} · {p.pin_type}
          </li>
        ))}
      </ul>
    </div>
  )
}
