import tinosWoff2 from '@fontsource/tinos/files/tinos-latin-400-normal.woff2?url'

/** Times New Roman is missing on most phones; Tinos is a metric-compatible stand-in. */
export const ATOM_FONT_FAMILY =
  "Tinos, 'Times New Roman', TimesNewRomanPSMT, Times, serif"

export const TINOS_WOFF2_URL = tinosWoff2

export const ATOM_LABEL_CSS = `
.formula-svg .atom,
.formula-svg .locant {
  font-family: ${ATOM_FONT_FAMILY};
  font-weight: 400;
}
`

/** In-SVG @font-face so mobile WebKit applies the webfont to <text>. */
export function atomFontSvgStyle(): string {
  return `<style>@font-face{font-family:Tinos;font-style:normal;font-weight:400;src:url(${TINOS_WOFF2_URL}) format("woff2")}.atom,.locant{font-family:${ATOM_FONT_FAMILY};font-weight:400}</style>`
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

let embeddedFace: string | null = null

/** Self-contained @font-face for PNG export (data-URI images cannot load external fonts). */
export async function tinosEmbeddedFontFace(): Promise<string> {
  if (embeddedFace) return embeddedFace
  const res = await fetch(TINOS_WOFF2_URL)
  if (!res.ok) throw new Error('無法載入原子字型。')
  const b64 = bufferToBase64(await res.arrayBuffer())
  embeddedFace = `@font-face{font-family:Tinos;font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${b64}) format("woff2")}`
  return embeddedFace
}
