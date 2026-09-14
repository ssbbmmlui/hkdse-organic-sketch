import { FORMULA_CSS } from './chemistry/styles'

function slug(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'compound'
}

function parseViewBox(svg: SVGSVGElement): { w: number; h: number } {
  const raw = svg.getAttribute('viewBox')
  if (raw) {
    const parts = raw.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { w: parts[2], h: parts[3] }
    }
  }
  const w = Number(svg.getAttribute('width')) || 400
  const h = Number(svg.getAttribute('height')) || 280
  return { w, h }
}

export function exportSvgMarkupAsPng(svgMarkup: string, compoundName: string, kind: 'structural' | 'skeletal') {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
  const svg = doc.documentElement
  if (!(svg instanceof SVGSVGElement) || doc.querySelector('parsererror')) {
    throw new Error('無法讀取結構圖。')
  }

  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = FORMULA_CSS
  svg.insertBefore(style, svg.firstChild)

  const { w, h } = parseViewBox(svg)
  const scale = Math.max(3, 1400 / Math.max(w, h))
  const width = Math.round(w * scale)
  const height = Math.round(h * scale)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))

  const xml = new XMLSerializer().serializeToString(svg)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  const filename = `${slug(compoundName)}-${kind}.png`

  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    canvas.toBlob((blob) => {
      if (!blob) return
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = filename
      a.click()
      URL.revokeObjectURL(href)
    }, 'image/png')
  }
  img.onerror = () => {
    throw new Error('無法匯出 PNG。')
  }
  img.src = url
}
