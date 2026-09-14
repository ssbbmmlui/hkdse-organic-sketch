/** Styles mirrored from index.css so the PNG matches the on-screen formula. */
const FORMULA_CSS = `
.formula-svg .bond {
  stroke: #1c2430;
  stroke-width: 1.35;
  stroke-linecap: butt;
}
.formula-svg.structural .bond { stroke-width: 1.15; }
.formula-svg.skeletal .bond { stroke-linecap: round; }
.formula-svg.skeletal .vertex { fill: #1c2430; }
.formula-svg .atom,
.formula-svg .locant {
  font-family: 'Times New Roman', Times, serif;
  font-weight: 400;
}
.formula-svg .atom {
  font-size: 15px;
  text-anchor: middle;
  dominant-baseline: middle;
  fill: #1c2430;
}
.formula-svg.structural .atom { font-size: 13px; }
.formula-svg.structural .atom.alkyl,
.formula-svg.structural .atom.compact { letter-spacing: -0.1em; }
.formula-svg.skeletal .atom.hetero { fill: #1f5c4d; }
.formula-svg .atom.anchor-start { text-anchor: start; }
.formula-svg .atom.anchor-end { text-anchor: end; }
.formula-svg .sub { font-size: 10px; }
.formula-svg.structural .sub { font-size: 8.5px; }
.formula-svg .locant {
  font-size: 8px;
  fill: #d32f2f;
  text-anchor: middle;
  dominant-baseline: middle;
}
`

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
