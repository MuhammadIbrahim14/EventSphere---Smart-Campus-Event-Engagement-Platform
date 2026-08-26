/**
 * Story-ready share card (1080x1920 canvas) + download / Web Share.
 */
import { Download, Share2 } from 'lucide-react'
import { bannerForEvent, characterForEvent } from '@/constants/campusCharacters'
import { logEventShare } from '@/services/share'
import { useAuth } from '@/context/AuthContext'

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function renderEventStoryCard(event) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext('2d')

  const grad = ctx.createLinearGradient(0, 0, 1080, 1920)
  grad.addColorStop(0, '#0b0a14')
  grad.addColorStop(0.5, '#12101c')
  grad.addColorStop(1, '#081018')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1080, 1920)

  const banner = bannerForEvent(event)
  if (banner) {
    try {
      const img = await loadImage(banner)
      ctx.globalAlpha = 0.45
      ctx.drawImage(img, 0, 0, 1080, 720)
      ctx.globalAlpha = 1
    } catch {
      /* ignore CORS failures */
    }
  }

  ctx.fillStyle = 'rgba(7,6,12,0.55)'
  ctx.fillRect(0, 560, 1080, 200)

  ctx.fillStyle = '#5ce1ff'
  ctx.font = '600 36px Inter, system-ui, sans-serif'
  ctx.fillText('EVENTSPHERE', 72, 640)

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 72px Inter, system-ui, sans-serif'
  const title = String(event?.title || 'Campus event')
  wrapText(ctx, title, 72, 760, 936, 82)

  ctx.fillStyle = '#aab0c8'
  ctx.font = '500 34px Inter, system-ui, sans-serif'
  ctx.fillText([event?.date, event?.time].filter(Boolean).join(' · ') || 'Date TBA', 72, 980)
  ctx.fillText(event?.venue || 'Campus venue', 72, 1040)

  try {
    const mascot = characterForEvent(event)
    const m = await loadImage(mascot.src)
    ctx.drawImage(m, 680, 1180, 320, 320)
  } catch {
    /* ignore */
  }

  ctx.fillStyle = '#ff4fd8'
  ctx.font = '600 28px Inter, system-ui, sans-serif'
  ctx.fillText('Scan the vibe · Join on EventSphere', 72, 1780)

  return canvas
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (let n = 0; n < words.length; n++) {
    const test = `${line}${words[n]} `
    if (ctx.measureText(test).width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, yy)
      line = `${words[n]} `
      yy += lineHeight
    } else {
      line = test
    }
  }
  ctx.fillText(line.trim(), x, yy)
}

export default function StoryShareButton({ event, setToast }) {
  const { user } = useAuth()
  if (!event) return null

  const download = async () => {
    try {
      const canvas = await renderEventStoryCard(event)
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `${event.symbol || 'event'}-story.png`
      a.click()
      setToast?.('Story card downloaded (1080×1920)')
      await logEventShare({
        userId: user?.id || null,
        eventId: event.id,
        platform: 'story_png',
        shareMessage: event.title,
      })
    } catch (err) {
      setToast?.(err?.message || 'Could not build story card')
    }
  }

  const shareNative = async () => {
    try {
      const canvas = await renderEventStoryCard(event)
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('Could not create image')
      const file = new File([blob], 'eventsphere-story.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: event.title,
          text: `Join me at ${event.title} on EventSphere`,
        })
        setToast?.('Shared to your apps')
      } else {
        await download()
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
      setToast?.(err?.message || 'Share cancelled')
    }
  }

  return (
    <div className="es-story-share" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" className="btn" onClick={download} data-testid="button-story-download">
        <Download size={14} /> Story card PNG
      </button>
      <button type="button" className="btn btn-primary" onClick={shareNative} data-testid="button-story-share">
        <Share2 size={14} /> Share story
      </button>
    </div>
  )
}
