function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

function hexToRgba(color, alpha = 1) {
  const raw = String(color || '').trim()
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    const n = parseInt(h, 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return `rgba(${r},${g},${b},${alpha})`
  }
  if (raw.startsWith('rgb')) {
    const nums = raw.replace(/[^\d.,]/g, '').split(',').map(Number)
    if (nums.length >= 3) return `rgba(${nums[0]},${nums[1]},${nums[2]},${alpha})`
  }
  return `rgba(196,181,253,${alpha})`
}

function readThemePalette() {
  return {
    stageFrom: cssVar('--te-stageFrom', '#0b0d18'),
    stageMid: cssVar('--te-stageMid', '#151936'),
    stageTo: cssVar('--te-stageTo', '#1a1430'),
    ink: cssVar('--te-ink', '#0a0614'),
    text: cssVar('--te-text', '#f4f5ff'),
    muted: cssVar('--te-muted', '#a8aec4'),
    cyan: cssVar('--te-cyan', '#54d8e8'),
    violet: cssVar('--te-violet', '#9a7bff'),
    pink: cssVar('--te-pink', '#cb8beb'),
    neon: cssVar('--te-neon', '#c4ff3e'),
    orbA: cssVar('--te-orbA', '#54d8e8'),
    orbB: cssVar('--te-orbB', '#9a7bff'),
    orbC: cssVar('--te-orbC', '#cb8beb'),
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  let line = ''
  let cy = y
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy)
      line = words[i]
      cy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, cy)
  return cy
}

function drawDottedField(ctx, width, height, color) {
  const step = 22
  ctx.fillStyle = color
  for (let x = 88; x < width - 88; x += step) {
    for (let y = 88; y < height - 88; y += step) {
      ctx.beginPath()
      ctx.arc(x, y, 1.15, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/**
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function buildCertificateImage({
  studentName,
  eventTitle,
  eventDate,
  issuedOn,
  organizerLabel = 'EventSphere Campus',
}) {
  const width = 1400
  const height = 990
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const t = readThemePalette()

  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, t.stageFrom || t.ink)
  bg.addColorStop(0.48, t.stageMid || t.ink)
  bg.addColorStop(1, t.stageTo || t.ink)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  drawDottedField(ctx, width, height, hexToRgba(t.muted, 0.14))

  ctx.fillStyle = hexToRgba(t.orbA || t.cyan, 0.16)
  ctx.beginPath()
  ctx.arc(220, 180, 170, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = hexToRgba(t.orbB || t.violet, 0.16)
  ctx.beginPath()
  ctx.arc(1180, 780, 210, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = hexToRgba(t.orbC || t.pink, 0.1)
  ctx.beginPath()
  ctx.arc(980, 220, 120, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = hexToRgba(t.violet, 0.55)
  ctx.lineWidth = 4
  ctx.strokeRect(48, 48, width - 96, height - 96)
  ctx.strokeStyle = hexToRgba(t.cyan, 0.4)
  ctx.lineWidth = 1.5
  ctx.strokeRect(68, 68, width - 136, height - 136)
  ctx.strokeStyle = hexToRgba(t.neon, 0.22)
  ctx.lineWidth = 1
  ctx.strokeRect(84, 84, width - 168, height - 168)

  ctx.fillStyle = t.cyan
  ctx.font = '700 18px system-ui,Segoe UI,sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('EVENTSPHERE', width / 2, 130)
  ctx.fillStyle = hexToRgba(t.muted, 0.95)
  ctx.font = '500 13px system-ui,Segoe UI,sans-serif'
  ctx.fillText('SMART CAMPUS EVENT & ENGAGEMENT', width / 2, 156)

  ctx.fillStyle = t.text
  ctx.font = '600 42px Georgia, "Times New Roman", serif'
  ctx.fillText('Certificate of Participation', width / 2, 240)

  ctx.fillStyle = hexToRgba(t.muted, 0.95)
  ctx.font = '400 18px system-ui,Segoe UI,sans-serif'
  ctx.fillText('This certifies that', width / 2, 310)

  ctx.fillStyle = t.text
  ctx.font = '700 48px Georgia, "Times New Roman", serif'
  ctx.fillText(String(studentName || 'Participant').slice(0, 48), width / 2, 380)

  ctx.fillStyle = hexToRgba(t.muted, 0.95)
  ctx.font = '400 18px system-ui,Segoe UI,sans-serif'
  ctx.fillText('successfully participated in', width / 2, 440)

  ctx.fillStyle = t.pink || t.violet
  ctx.font = '600 34px Georgia, "Times New Roman", serif'
  wrapText(ctx, String(eventTitle || 'Campus Event').slice(0, 80), width / 2, 500, 980, 42)

  const dateLine = eventDate ? `Event date: ${String(eventDate).slice(0, 10)}` : ''
  const issuedLine = issuedOn
    ? `Issued: ${new Date(issuedOn).toLocaleDateString()}`
    : `Issued: ${new Date().toLocaleDateString()}`
  ctx.fillStyle = hexToRgba(t.muted, 0.9)
  ctx.font = '400 16px system-ui,Segoe UI,sans-serif'
  ctx.fillText([dateLine, issuedLine].filter(Boolean).join('  ·  '), width / 2, 620)

  ctx.strokeStyle = hexToRgba(t.text, 0.22)
  ctx.beginPath()
  ctx.moveTo(280, 780)
  ctx.lineTo(520, 780)
  ctx.moveTo(880, 780)
  ctx.lineTo(1120, 780)
  ctx.stroke()
  ctx.fillStyle = hexToRgba(t.muted, 0.9)
  ctx.font = '500 14px system-ui,Segoe UI,sans-serif'
  ctx.fillText('Organizer', 400, 810)
  ctx.fillText(String(organizerLabel).slice(0, 28), 1000, 810)

  ctx.fillStyle = hexToRgba(t.violet, 0.95)
  ctx.font = '600 12px system-ui,Segoe UI,sans-serif'
  ctx.fillText('Generated by EventSphere · campus student credential', width / 2, 900)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  const safeTitle = String(eventTitle || 'event')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 40)
  return {
    blob,
    filename: `EventSphere_Certificate_${safeTitle}.png`,
  }
}

export async function downloadCertificate(opts) {
  const { blob, filename } = await buildCertificateImage(opts)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return { filename }
}

/** Opens a print-friendly dialog (browser → Save as PDF) via hidden iframe. */
export function printCertificate(opts) {
  const name = String(opts.studentName || 'Participant')
  const title = String(opts.eventTitle || 'Campus Event')
  const date = opts.eventDate ? String(opts.eventDate).slice(0, 10) : ''
  const issued = opts.issuedOn
    ? new Date(opts.issuedOn).toLocaleDateString()
    : new Date().toLocaleDateString()
  const t = readThemePalette()

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Certificate — ${title}</title>
    <style>
      @page { size: landscape; margin: 14mm; }
      body {
        margin: 0; padding: 28px;
        font-family: Georgia, "Times New Roman", serif;
        text-align: center;
        color: ${t.text};
        background:
          radial-gradient(circle at 1px 1px, ${hexToRgba(t.muted, 0.28)} 1px, transparent 0) 0 0 / 18px 18px,
          linear-gradient(145deg, ${t.stageFrom}, ${t.stageMid}, ${t.stageTo});
        min-height: 100vh;
        box-sizing: border-box;
      }
      .frame {
        border: 3px solid ${hexToRgba(t.violet, 0.7)};
        outline: 1px solid ${hexToRgba(t.cyan, 0.45)};
        outline-offset: 10px;
        padding: 40px 36px;
        max-width: 980px;
        margin: 0 auto;
        background: ${hexToRgba(t.ink, 0.35)};
      }
      .brand { letter-spacing: .22em; font-size: 12px; color: ${t.cyan}; font-family: system-ui,sans-serif; font-weight: 700; }
      .sub { font-family: system-ui,sans-serif; font-size: 11px; color: ${t.muted}; margin-top: 6px; letter-spacing: .08em; }
      h1 { font-size: 34px; margin: 28px 0 10px; color: ${t.text}; }
      .name { font-size: 40px; margin: 24px 0; color: ${t.text}; }
      .event { font-size: 26px; color: ${t.pink || t.violet}; margin: 18px 0; }
      .meta { font-family: system-ui,sans-serif; font-size: 13px; color: ${t.muted}; margin-top: 28px; }
      p { color: ${t.muted}; }
    </style></head><body>
    <div class="frame">
      <div class="brand">EVENTSPHERE</div>
      <div class="sub">SMART CAMPUS EVENT &amp; ENGAGEMENT</div>
      <h1>Certificate of Participation</h1>
      <p>This certifies that</p>
      <div class="name">${name}</div>
      <p>successfully participated in</p>
      <div class="event">${title}</div>
      <div class="meta">${date ? `Event date: ${date} · ` : ''}Issued: ${issued}</div>
    </div>
    </body></html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    return { error: { message: 'Could not open print dialog' } }
  }
  doc.open()
  doc.write(html)
  doc.close()

  const runPrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      window.setTimeout(() => iframe.remove(), 1500)
    }
  }
  window.setTimeout(runPrint, 80)
  return { error: null }
}
