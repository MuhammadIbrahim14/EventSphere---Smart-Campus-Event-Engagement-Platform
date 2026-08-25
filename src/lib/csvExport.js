/** Browser CSV download helper (Phase C admin reports). */

export function downloadCsv(filename, rows) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return { error: { message: 'Nothing to export' } }

  const keys = Object.keys(list[0])
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const lines = [
    keys.join(','),
    ...list.map((row) => keys.map((k) => escape(row[k])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
  return { error: null }
}
