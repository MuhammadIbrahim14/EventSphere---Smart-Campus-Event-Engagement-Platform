import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff } from 'lucide-react'

function pickBackCamera(cameras) {
  if (!cameras?.length) return null
  const rear = cameras.find((c) => /back|rear|environment/i.test(c.label || ''))
  return rear || cameras[0]
}

export default function PassQrCameraScanner({
  active = true,
  disabled = false,
  onScan,
  scanCooldownMs = 2800,
}) {
  const elementId = useId().replace(/:/g, '')
  const scannerRef = useRef(null)
  const lastScanRef = useRef({ text: '', at: 0 })
  const onScanRef = useRef(onScan)
  const disabledRef = useRef(disabled)
  const [cameraOn, setCameraOn] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    scannerRef.current = null
    try {
      if (scanner.isScanning) await scanner.stop()
    } catch {
      /* ignore stop races */
    }
    try {
      scanner.clear()
    } catch {
      /* ignore clear races */
    }
  }, [])

  // Only start/stop when camera power or tab visibility changes — never on parent re-render.
  useEffect(() => {
    if (!active || !cameraOn) {
      void stopScanner()
      return undefined
    }

    let cancelled = false
    const scanner = new Html5Qrcode(elementId, { verbose: false })
    scannerRef.current = scanner
    setStarting(true)
    setError('')

    async function start() {
      try {
        const cameras = await Html5Qrcode.getCameras()
        if (cancelled) return
        const camera = pickBackCamera(cameras)
        if (!camera) {
          setError('No camera found on this device')
          setCameraOn(false)
          return
        }
        await scanner.start(
          camera.id,
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (cancelled) return
            const payload = String(decodedText || '').trim()
            if (!payload || disabledRef.current) return
            const now = Date.now()
            const last = lastScanRef.current
            if (payload === last.text && now - last.at < scanCooldownMs) return
            lastScanRef.current = { text: payload, at: now }
            onScanRef.current?.(payload)
          },
          () => {},
        )
        if (!cancelled) setError('')
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not access camera — allow permission and retry')
          setCameraOn(false)
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      void stopScanner()
    }
  }, [active, cameraOn, elementId, scanCooldownMs, stopScanner])

  useEffect(() => {
    if (active) setCameraOn(true)
    else setCameraOn(false)
  }, [active])

  return (
    <div className="es-qr-scan__camera" data-testid="pass-qr-camera">
      <div className="es-qr-scan__viewport-wrap">
        <div id={elementId} className="es-qr-scan__viewport" />
        {!cameraOn && (
          <div className="es-qr-scan__viewport-placeholder">
            <CameraOff size={28} strokeWidth={1.5} />
            <span>Camera off</span>
          </div>
        )}
        {starting && cameraOn && (
          <div className="es-qr-scan__viewport-loading">Starting camera…</div>
        )}
      </div>

      {error ? (
        <p className="es-qr-scan__camera-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="muted es-qr-scan__camera-hint">
          Keep camera on — scan the next pass after each Present. Point at{' '}
          <strong>My Passes / Guest wallet</strong> QR.
        </p>
      )}

      <button
        type="button"
        className={`btn ${cameraOn ? '' : 'btn-primary'}`}
        disabled={starting}
        onClick={() => setCameraOn((on) => !on)}
        data-testid="button-toggle-camera"
      >
        {cameraOn ? <CameraOff size={14} /> : <Camera size={14} />}
        {cameraOn ? 'Turn camera off' : 'Turn camera on'}
      </button>
    </div>
  )
}
