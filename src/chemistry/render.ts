import {
  aldehydeHydrogenIds,
  bounds,
  compactAlkylGroups,
  compactAminoGroups,
  layoutSkeletal,
  layoutStructural,
  neighborsOf,
  type Point,
} from './layout'
import type { Molecule } from './types'

function shorten(a: Point, b: Point, ra: number, rb: number): [Point, Point] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1
  return [
    { x: a.x + (dx / d) * ra, y: a.y + (dy / d) * ra },
    { x: b.x - (dx / d) * rb, y: b.y - (dy / d) * rb },
  ]
}

function parallel(a: Point, b: Point, offset: number): [Point, Point] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1
  const ox = (-dy / d) * offset
  const oy = (dx / d) * offset
  return [
    { x: a.x + ox, y: a.y + oy },
    { x: b.x + ox, y: b.y + oy },
  ]
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function svgWrap(body: string, box: { minX: number; minY: number; width: number; height: number }, className: string): string {
  return `<svg class="${className}" viewBox="${box.minX} ${box.minY} ${box.width} ${box.height}" xmlns="http://www.w3.org/2000/svg" role="img">${body}</svg>`
}

function elOf(mol: Molecule, id: number) {
  return mol.atoms.find((x) => x.id === id)!.el
}

function heavyNeighbor(mol: Molecule, atomId: number): number | null {
  for (const n of neighborsOf(atomId, mol.bonds)) {
    if (elOf(mol, n.other) !== 'H') return n.other
  }
  return null
}

/** Oxygen of an –OH group (one H and one heavy neighbour). */
function hydroxylMap(mol: Molecule): Map<number, { hydrogen: number; carbon: number }> {
  const out = new Map<number, { hydrogen: number; carbon: number }>()
  for (const atom of mol.atoms) {
    if (atom.el !== 'O') continue
    const nb = neighborsOf(atom.id, mol.bonds)
    const hs = nb.filter((n) => elOf(mol, n.other) === 'H')
    const heavy = nb.filter((n) => elOf(mol, n.other) !== 'H')
    if (hs.length === 1 && heavy.length === 1) {
      out.set(atom.id, { hydrogen: hs[0].other, carbon: heavy[0].other })
    }
  }
  return out
}

function amideNitrogens(mol: Molecule): Map<number, number[]> {
  const out = new Map<number, number[]>()
  for (const atom of mol.atoms) {
    if (atom.el !== 'N') continue
    const nb = neighborsOf(atom.id, mol.bonds)
    const hs = nb.filter((n) => elOf(mol, n.other) === 'H').map((n) => n.other)
    const heavy = nb.filter((n) => elOf(mol, n.other) !== 'H')
    if (hs.length === 2 && heavy.length === 1) out.set(atom.id, hs)
  }
  return out
}

function bondKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function sideOf(from: Point, to: Point): 'N' | 'E' | 'S' | 'W' {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'E' : 'W'
  return dy >= 0 ? 'S' : 'N'
}

function hydroxylLetters(oxygen: Point, carbon: Point): { hx: number; hy: number; anchor: 'start' | 'end' } {
  const side = sideOf(carbon, oxygen)
  if (side === 'W') return { hx: oxygen.x - 5.5, hy: oxygen.y, anchor: 'end' }
  if (side === 'E') return { hx: oxygen.x + 5.5, hy: oxygen.y, anchor: 'start' }
  if (side === 'N') return { hx: oxygen.x + 5.5, hy: oxygen.y, anchor: 'start' }
  return { hx: oxygen.x + 5.5, hy: oxygen.y, anchor: 'start' }
}

function lineSeg(s: Point, t: Point): string {
  return `<line x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}" class="bond" />`
}

function insetEnds(a: Point, b: Point, pad: number): [Point, Point] {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const k = Math.min(pad, d / 2 - 0.4)
  if (k <= 0) return [a, b]
  return [
    { x: a.x + ((b.x - a.x) / d) * k, y: a.y + ((b.y - a.y) / d) * k },
    { x: b.x - ((b.x - a.x) / d) * k, y: b.y - ((b.y - a.y) / d) * k },
  ]
}

function chainForward(mol: Molecule, a: number, b: number): [number, number] {
  const ia = mol.chain.indexOf(a)
  const ib = mol.chain.indexOf(b)
  if (ia !== -1 && ib !== -1 && ib < ia) return [b, a]
  return [a, b]
}

function drawBond(
  s: Point,
  t: Point,
  order: 1 | 2 | 3,
  style: 'symmetric' | 'offset' = 'symmetric',
  forward?: { from: Point; to: Point },
): string {
  if (order !== 2) return lineSeg(s, t)
  if (style === 'offset') {
    const from = forward?.from ?? s
    const to = forward?.to ?? t
    const dx = to.x - from.x
    const dy = to.y - from.y
    const d = Math.hypot(dx, dy) || 1
    // Screen-left of C1→Cn: sits above a left-to-right bond (ChemDraw / ACS).
    const ox = (dy / d) * 4.4
    const oy = (-dx / d) * 4.4
    const [s2, t2] = insetEnds({ x: s.x + ox, y: s.y + oy }, { x: t.x + ox, y: t.y + oy }, 6)
    return lineSeg(s, t) + lineSeg(s2, t2)
  }
  const [s1, t1] = parallel(s, t, 1.7)
  const [s2, t2] = parallel(s, t, -1.7)
  return lineSeg(s1, t1) + lineSeg(s2, t2)
}

/** Two C=O strokes sit on the left and right of the carbon tip. */
function drawSkeletalOxo(carbon: Point, oxygenEnd: Point): string {
  const dx = oxygenEnd.x - carbon.x
  const dy = oxygenEnd.y - carbon.y
  const d = Math.hypot(dx, dy) || 1
  const nx = -dy / d
  const ny = dx / d
  const off = 1.7
  return (
    lineSeg(
      { x: carbon.x + nx * off, y: carbon.y + ny * off },
      { x: oxygenEnd.x + nx * off, y: oxygenEnd.y + ny * off },
    ) +
    lineSeg(
      { x: carbon.x - nx * off, y: carbon.y - ny * off },
      { x: oxygenEnd.x - nx * off, y: oxygenEnd.y - ny * off },
    )
  )
}

/**
 * Times + dominant-baseline:middle sits a little high, so bonds to atoms
 * above the chain look longer than bonds to atoms below. Nudge labels down.
 */
const STRUCTURAL_GLYPH_DY = 1.6

function atomText(x: number, y: number, cls: string, html: string, dy = 0): string {
  const dyAttr = dy ? ` dy="${dy}"` : ''
  return `<text x="${x}" y="${y}"${dyAttr} class="${cls}">${html}</text>`
}

function drawOH(
  oxygenId: number,
  pos: Map<number, Point>,
  hydroxyls: Map<number, { hydrogen: number; carbon: number }>,
  glyphDy = 0,
): { svg: string; extra: Point } {
  const p = pos.get(oxygenId)!
  const carbon = pos.get(hydroxyls.get(oxygenId)!.carbon) ?? p
  const h = hydroxylLetters(p, carbon)
  const svg =
    atomText(p.x, p.y, 'atom hetero O', 'O', glyphDy) +
    atomText(h.hx, h.hy, `atom hetero H anchor-${h.anchor}`, 'H', glyphDy)
  return { svg, extra: { x: h.hx + (h.anchor === 'end' ? -8 : 8), y: h.hy } }
}

/** N sits on the bond; H₂ is written beside it, away from the carbon. */
function drawNH2(nitrogen: Point, carbon: Point, asAlkyl = false, glyphDy = 0): { svg: string; extra: Point } {
  const side = sideOf(carbon, nitrogen)
  const toLeft = asAlkyl ? side === 'W' : nitrogen.x <= carbon.x
  const gap = asAlkyl ? 5.2 : 5.5
  const tx = nitrogen.x + (toLeft ? -gap : gap)
  const svg =
    atomText(nitrogen.x, nitrogen.y, 'atom hetero N', 'N', glyphDy) +
    atomText(tx, nitrogen.y, `atom hetero N compact anchor-${toLeft ? 'end' : 'start'}`, withSubscripts('H2'), glyphDy)
  return {
    svg,
    extra: { x: nitrogen.x + (toLeft ? -18 : 18), y: nitrogen.y },
  }
}

function radiusFor(el: string, mode: 'structural' | 'skeletal', isHydroxylO = false): number {
  if (mode === 'structural') return 8
  if (el === 'C') return 0
  if (el === 'H') return 8
  if (isHydroxylO) return 8
  if (el === 'Cl' || el === 'Br') return 12
  return 10
}

function withSubscripts(s: string): string {
  const digit = (ch: string) => {
    const i = '₀₁₂₃₄₅₆₇₈₉'.indexOf(ch)
    if (i !== -1) return String(i)
    return /[0-9]/.test(ch) ? ch : null
  }
  let html = ''
  let lowered = false
  for (const ch of [...s]) {
    const d = digit(ch)
    if (d !== null) {
      html += lowered ? `<tspan class="sub">${d}</tspan>` : `<tspan class="sub" dy="2.6">${d}</tspan>`
      lowered = true
    } else if (lowered) {
      html += `<tspan dy="-2.6">${escape(ch)}</tspan>`
      lowered = false
    } else {
      html += escape(ch)
    }
  }
  return html
}

/** C sits on the bond; H₃ / ₂H₅ is written beside it with true subscripts. */
function drawAlkyl(label: string, carbon: Point, parent: Point, glyphDy = 0): { svg: string; extras: Point[] } {
  const side = sideOf(parent, carbon)
  const tail = label.startsWith('C') ? label.slice(1) : label
  const toLeft = side === 'W'
  const tx = carbon.x + (toLeft ? -5.2 : 5.2)
  const svg =
    atomText(carbon.x, carbon.y, 'atom alkyl', 'C', glyphDy) +
    atomText(tx, carbon.y, `atom alkyl compact anchor-${toLeft ? 'end' : 'start'}`, withSubscripts(tail), glyphDy)
  return {
    svg,
    extras: [{ x: carbon.x + (toLeft ? -16 : 16), y: carbon.y }],
  }
}

export function renderStructuralSvg(mol: Molecule, showNumbers = false): string {
  const pos = layoutStructural(mol)
  const hydroxyls = hydroxylMap(mol)
  const alkyls = compactAlkylGroups(mol)
  const alkylRoot = new Map(alkyls.map((g) => [g.root, g]))
  const aminos = compactAminoGroups(mol)
  const aminoN = new Map(aminos.map((g) => [g.nitrogen, g]))
  const skipH = new Set<number>()
  const skipAlkyl = new Set<number>()
  const skipBonds = new Set<string>()
  for (const [o, info] of hydroxyls) {
    skipH.add(info.hydrogen)
    skipBonds.add(bondKey(o, info.hydrogen))
  }
  for (const g of alkyls) {
    for (const id of g.memberIds) {
      if (id !== g.root) skipAlkyl.add(id)
    }
  }
  for (const g of aminos) {
    for (const id of g.memberIds) {
      if (id === g.nitrogen) continue
      skipH.add(id)
      skipBonds.add(bondKey(g.nitrogen, id))
    }
  }

  const extras: Point[] = []
  const parts: string[] = []

  for (const bond of mol.bonds) {
    if (skipBonds.has(bondKey(bond.a, bond.b))) continue
    const a = mol.atoms.find((x) => x.id === bond.a)!
    const b = mol.atoms.find((x) => x.id === bond.b)!
    if (skipH.has(a.id) || skipH.has(b.id) || skipAlkyl.has(a.id) || skipAlkyl.has(b.id)) continue
    const pa = pos.get(a.id)
    const pb = pos.get(b.id)
    if (!pa || !pb) continue
    const [s, t] = shorten(
      pa,
      pb,
      radiusFor(a.el, 'structural', hydroxyls.has(a.id)),
      radiusFor(b.el, 'structural', hydroxyls.has(b.id)),
    )
    parts.push(drawBond(s, t, bond.order))
  }

  for (const atom of mol.atoms) {
    if (skipH.has(atom.id) || skipAlkyl.has(atom.id)) continue
    if (hydroxyls.has(atom.id)) {
      const drawn = drawOH(atom.id, pos, hydroxyls, STRUCTURAL_GLYPH_DY)
      parts.push(drawn.svg)
      extras.push(drawn.extra)
      continue
    }
    const p = pos.get(atom.id)
    if (!p) continue
    const alkyl = alkylRoot.get(atom.id)
    if (alkyl) {
      const drawn = drawAlkyl(alkyl.label, p, pos.get(alkyl.parent) ?? p, STRUCTURAL_GLYPH_DY)
      parts.push(drawn.svg)
      extras.push(...drawn.extras)
      continue
    }
    const amino = aminoN.get(atom.id)
    if (amino) {
      const drawn = drawNH2(p, pos.get(amino.parent) ?? p, true, STRUCTURAL_GLYPH_DY)
      parts.push(drawn.svg)
      extras.push(drawn.extra)
      continue
    }
    const cls = atom.el === 'H' ? 'atom H' : atom.el === 'C' ? 'atom C' : `atom hetero ${atom.el}`
    parts.push(atomText(p.x, p.y, cls, escape(atom.el), STRUCTURAL_GLYPH_DY))
  }

  if (showNumbers) {
    mol.chain.forEach((id, i) => {
      const p = pos.get(id)!
      parts.push(`<text x="${p.x - 6}" y="${p.y + 7}" class="locant">${i + 1}</text>`)
    })
  }

  const box = bounds([...pos].filter(([id]) => !skipH.has(id)).map(([, p]) => p).concat(extras), 32)
  return svgWrap(parts.join(''), box, 'formula-svg structural')
}

export function renderSkeletalSvg(mol: Molecule): string {
  const pos = layoutSkeletal(mol)
  const hydroxyls = hydroxylMap(mol)
  const amides = amideNitrogens(mol)
  const aldehydeHs = aldehydeHydrogenIds(mol)
  const skipBonds = new Set<string>()
  for (const [o, info] of hydroxyls) skipBonds.add(bondKey(o, info.hydrogen))
  for (const [n, hs] of amides) {
    for (const h of hs) skipBonds.add(bondKey(n, h))
  }

  const extras: Point[] = []
  const parts: string[] = []

  for (const bond of mol.bonds) {
    if (skipBonds.has(bondKey(bond.a, bond.b))) continue
    const a = mol.atoms.find((x) => x.id === bond.a)!
    const b = mol.atoms.find((x) => x.id === bond.b)!
    const showH = aldehydeHs.has(a.id) || aldehydeHs.has(b.id)
    if ((a.el === 'H' || b.el === 'H') && !showH) continue
    const pa = pos.get(a.id)
    const pb = pos.get(b.id)
    if (!pa || !pb) continue
    const [s, t] = shorten(
      pa,
      pb,
      radiusFor(a.el, 'skeletal', hydroxyls.has(a.id)),
      radiusFor(b.el, 'skeletal', hydroxyls.has(b.id)),
    )
    if (bond.order === 2 && a.el === 'C' && b.el === 'C') {
      const [fid, tid] = chainForward(mol, a.id, b.id)
      parts.push(drawBond(s, t, 2, 'offset', { from: pos.get(fid)!, to: pos.get(tid)! }))
    } else if (bond.order === 2) {
      const carbon = a.el === 'C' ? pa : pb
      const oxygenEnd = a.el === 'C' ? t : s
      parts.push(drawSkeletalOxo(carbon, oxygenEnd))
    } else {
      parts.push(drawBond(s, t, bond.order))
    }
  }

  for (const atom of mol.atoms) {
    if (atom.el !== 'C') continue
    const heavy = neighborsOf(atom.id, mol.bonds).filter((n) => elOf(mol, n.other) !== 'H')
    if (heavy.length < 2) continue
    const p = pos.get(atom.id)
    if (!p) continue
    parts.push(`<circle class="vertex" cx="${p.x}" cy="${p.y}" r="0.68" />`)
  }

  for (const atom of mol.atoms) {
    if (atom.el === 'C') continue
    if (atom.el === 'H' && !aldehydeHs.has(atom.id)) continue
    const p = pos.get(atom.id)
    if (!p) continue
    if (hydroxyls.has(atom.id)) {
      const drawn = drawOH(atom.id, pos, hydroxyls)
      parts.push(drawn.svg)
      extras.push(drawn.extra)
      continue
    }
    if (amides.has(atom.id)) {
      const carbon = pos.get(heavyNeighbor(mol, atom.id) ?? atom.id) ?? p
      const drawn = drawNH2(p, carbon)
      parts.push(drawn.svg)
      extras.push(drawn.extra)
      continue
    }
    if (aldehydeHs.has(atom.id)) {
      parts.push(`<text x="${p.x}" y="${p.y}" class="atom H">${escape(atom.el)}</text>`)
      extras.push(p)
      continue
    }
    parts.push(`<text x="${p.x}" y="${p.y}" class="atom hetero ${atom.el}">${escape(atom.el === 'Cl' ? 'Cl' : atom.el)}</text>`)
  }

  const visible = [...pos.entries()]
    .filter(([id]) => elOf(mol, id) !== 'H' || aldehydeHs.has(id))
    .map(([, p]) => p)
  const box = bounds(visible.concat(extras), 30)
  return svgWrap(parts.join(''), box, 'formula-svg skeletal')
}

export function renderBoth(mol: Molecule, showNumbers = false): { structural: string; skeletal: string } {
  return {
    structural: renderStructuralSvg(mol, showNumbers),
    skeletal: renderSkeletalSvg(mol),
  }
}
