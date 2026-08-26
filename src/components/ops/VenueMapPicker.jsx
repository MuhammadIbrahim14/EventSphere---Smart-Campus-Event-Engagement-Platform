import { useEffect, useRef, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { hasGoogleMapsApiKey, loadGoogleMaps, onGoogleMapsAuthFailure } from '@/lib/googleMaps'

/** Default campus-ish center (Lahore) when no coords yet */
const DEFAULT_CENTER = { lat: 31.5204, lng: 74.3587 }
const DEFAULT_ZOOM = 14

/**
 * Live map + Places search for venue location.
 * Falls back to plain text input when API key is missing.
 */
export default function VenueMapPicker({
  location = '',
  latitude = null,
  longitude = null,
  onChange,
}) {
  const mapEl = useRef(null)
  const searchEl = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const autocompleteRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const mapsEnabled = hasGoogleMapsApiKey()

  function emit(next) {
    onChange?.(next)
  }

  useEffect(() => {
    if (!mapsEnabled || !mapEl.current) return undefined
    let cancelled = false

    onGoogleMapsAuthFailure((msg) => {
      if (!cancelled) setError(msg)
    })

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapEl.current) return

        const hasCoords =
          latitude != null &&
          longitude != null &&
          Number.isFinite(Number(latitude)) &&
          Number.isFinite(Number(longitude))
        const center = hasCoords
          ? { lat: Number(latitude), lng: Number(longitude) }
          : DEFAULT_CENTER

        const map = new maps.Map(mapEl.current, {
          center,
          zoom: hasCoords ? 16 : DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: true,
        })
        mapRef.current = map

        const marker = new maps.Marker({
          map,
          position: center,
          draggable: true,
          animation: hasCoords ? maps.Animation.DROP : undefined,
          visible: hasCoords,
        })
        markerRef.current = marker

        marker.addListener('dragend', () => {
          const pos = marker.getPosition()
          if (!pos) return
          const lat = pos.lat()
          const lng = pos.lng()
          reverseGeocode(maps, lat, lng).then((address) => {
            emit({
              location: address || location || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
              latitude: lat,
              longitude: lng,
              map_place_id: null,
            })
          })
        })

        map.addListener('click', (e) => {
          if (!e.latLng) return
          const lat = e.latLng.lat()
          const lng = e.latLng.lng()
          marker.setPosition(e.latLng)
          marker.setVisible(true)
          reverseGeocode(maps, lat, lng).then((address) => {
            emit({
              location: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
              latitude: lat,
              longitude: lng,
              map_place_id: null,
            })
          })
        })

        if (searchEl.current && maps.places?.Autocomplete) {
          const ac = new maps.places.Autocomplete(searchEl.current, {
            fields: ['formatted_address', 'geometry', 'name', 'place_id'],
          })
          autocompleteRef.current = ac
          ac.bindTo('bounds', map)
          ac.addListener('place_changed', () => {
            const place = ac.getPlace()
            const loc = place?.geometry?.location
            if (!loc) {
              setError('No map location for that place — try another search.')
              return
            }
            setError('')
            const lat = loc.lat()
            const lng = loc.lng()
            map.panTo(loc)
            map.setZoom(16)
            marker.setPosition(loc)
            marker.setVisible(true)
            const label =
              place.formatted_address ||
              place.name ||
              `${lat.toFixed(5)}, ${lng.toFixed(5)}`
            emit({
              location: label,
              latitude: lat,
              longitude: lng,
              map_place_id: place.place_id || null,
            })
          })
        }

        setReady(true)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Map failed to load')
      })

    return () => {
      cancelled = true
      autocompleteRef.current = null
      markerRef.current = null
      mapRef.current = null
    }
    // Mount once per open; coords synced via separate effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsEnabled])

  useEffect(() => {
    const maps = typeof window !== 'undefined' ? window.google?.maps : null
    const map = mapRef.current
    const marker = markerRef.current
    if (!maps || !map || !marker) return
    if (latitude == null || longitude == null) return
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const pos = { lat, lng }
    marker.setPosition(pos)
    marker.setVisible(true)
    map.panTo(pos)
  }, [latitude, longitude])

  if (!mapsEnabled) {
    return (
      <div className="full">
        <label className="label">Location</label>
        <input
          className="input"
          value={location}
          onChange={(e) =>
            emit({
              location: e.target.value,
              latitude: null,
              longitude: null,
              map_place_id: null,
            })
          }
          placeholder="Building / campus address"
          data-testid="input-venue-location"
        />
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
          Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to .env for live map search & pin drop.
        </p>
      </div>
    )
  }

  return (
    <div className="full venue-map-picker">
      <label className="label">Location on map</label>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: 0.55,
            pointerEvents: 'none',
          }}
        />
        <input
          ref={searchEl}
          className="input"
          type="search"
          placeholder="Search campus, building, or address…"
          defaultValue=""
          autoComplete="off"
          data-testid="input-venue-map-search"
          style={{ paddingLeft: 34 }}
        />
      </div>
      <input
        className="input"
        value={location}
        onChange={(e) =>
          emit({
            location: e.target.value,
            latitude,
            longitude,
            map_place_id: null,
          })
        }
        placeholder="Selected address (editable)"
        data-testid="input-venue-location"
        style={{ marginBottom: 8 }}
      />
      <div
        ref={mapEl}
        className="venue-map-picker__canvas"
        data-testid="venue-map-canvas"
        style={{
          width: '100%',
          height: 240,
          borderRadius: 12,
          border: '1px solid color-mix(in oklab, var(--line) 80%, transparent)',
          overflow: 'hidden',
          background: 'color-mix(in oklab, var(--panel) 90%, #000)',
        }}
      />
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <MapPin size={12} />
        {ready
          ? 'Search a place, or click / drag the pin on the map.'
          : error || 'Loading map…'}
      </p>
      {latitude != null && longitude != null && (
        <p className="mono muted" style={{ margin: '4px 0 0', fontSize: 11 }}>
          {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
        </p>
      )}
    </div>
  )
}

function reverseGeocode(maps, lat, lng) {
  return new Promise((resolve) => {
    if (!maps?.Geocoder) {
      resolve('')
      return
    }
    const geocoder = new maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]?.formatted_address) {
        resolve(results[0].formatted_address)
      } else {
        resolve('')
      }
    })
  })
}
