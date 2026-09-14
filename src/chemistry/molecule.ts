import {
  ALKYL_CARBONS,
  HALO_ELEMENT,
  NameError,
  VALENCE,
  type Atom,
  type Bond,
  type Element,
  type Molecule,
  type ParsedCompound,
} from './types'
import { parseIupacName } from './parser'

function usedValence(id: number, bonds: Bond[]): number {
  let n = 0
  for (const b of bonds) {
    if (b.a === id || b.b === id) n += b.order
  }
  return n
}

function neighbors(id: number, bonds: Bond[]): { other: number; order: 1 | 2 | 3 }[] {
  const out: { other: number; order: 1 | 2 | 3 }[] = []
  for (const b of bonds) {
    if (b.a === id) out.push({ other: b.b, order: b.order })
    else if (b.b === id) out.push({ other: b.a, order: b.order })
  }
  return out
}

function addAlkyl(from: number, carbons: number, atoms: Atom[], bonds: Bond[], nextId: () => number): number {
  let prev = from
  let last = from
  for (let i = 0; i < carbons; i += 1) {
    const id = nextId()
    atoms.push({ id, el: 'C' })
    bonds.push({ a: prev, b: id, order: 1 })
    last = id
    prev = id
  }
  return last
}

function attachOH(carbon: number, atoms: Atom[], bonds: Bond[], nextId: () => number): void {
  const o = nextId()
  atoms.push({ id: o, el: 'O' })
  bonds.push({ a: carbon, b: o, order: 1 })
}

function attachCarbonyl(carbon: number, atoms: Atom[], bonds: Bond[], nextId: () => number): void {
  const o = nextId()
  atoms.push({ id: o, el: 'O' })
  bonds.push({ a: carbon, b: o, order: 2 })
}

function attachNH2(carbon: number, atoms: Atom[], bonds: Bond[], nextId: () => number): void {
  const n = nextId()
  atoms.push({ id: n, el: 'N' })
  bonds.push({ a: carbon, b: n, order: 1 })
}

export function buildMolecule(parsed: ParsedCompound): Molecule {
  const atoms: Atom[] = []
  const bonds: Bond[] = []
  let seq = 0
  const nextId = () => seq++

  const chain: number[] = []
  for (let i = 0; i < parsed.chainLength; i += 1) {
    const id = nextId()
    atoms.push({ id, el: 'C' })
    chain.push(id)
  }
  for (let i = 0; i < chain.length - 1; i += 1) {
    const order: 1 | 2 = parsed.doubleBonds.includes(i + 1) ? 2 : 1
    bonds.push({ a: chain[i], b: chain[i + 1], order })
  }

  for (const loc of parsed.carbonyls) attachCarbonyl(chain[loc - 1], atoms, bonds, nextId)
  for (const loc of parsed.carboxyls) {
    attachCarbonyl(chain[loc - 1], atoms, bonds, nextId)
    if (!parsed.esterAlkoxy) attachOH(chain[loc - 1], atoms, bonds, nextId)
  }
  for (const loc of parsed.amides) {
    attachCarbonyl(chain[loc - 1], atoms, bonds, nextId)
    attachNH2(chain[loc - 1], atoms, bonds, nextId)
  }
  for (const loc of parsed.hydroxyls) attachOH(chain[loc - 1], atoms, bonds, nextId)
  for (const loc of parsed.amines) attachNH2(chain[loc - 1], atoms, bonds, nextId)

  if (parsed.esterAlkoxy) {
    const o = nextId()
    atoms.push({ id: o, el: 'O' })
    bonds.push({ a: chain[0], b: o, order: 1 })
    const first = nextId()
    atoms.push({ id: first, el: 'C' })
    bonds.push({ a: o, b: first, order: 1 })
    let prev = first
    for (let i = 1; i < parsed.esterAlkoxy.carbons; i += 1) {
      const id = nextId()
      atoms.push({ id, el: 'C' })
      bonds.push({ a: prev, b: id, order: 1 })
      prev = id
    }
    for (let i = 0; i < (parsed.esterAlkoxy.methylOnFirst ?? 0); i += 1) {
      addAlkyl(first, 1, atoms, bonds, nextId)
    }
  }

  for (const sub of parsed.substituents) {
    for (const loc of sub.locants) {
      const carbon = chain[loc - 1]
      const halo = HALO_ELEMENT[sub.kind]
      if (halo) {
        const id = nextId()
        atoms.push({ id, el: halo })
        bonds.push({ a: carbon, b: id, order: 1 })
      } else {
        const n = ALKYL_CARBONS[sub.kind]
        if (!n) {
          throw new NameError(`Unknown substituent ${sub.kind}`, `不支援的取代基 ${sub.kind}。`)
        }
        addAlkyl(carbon, n, atoms, bonds, nextId)
      }
    }
  }

  for (const atom of [...atoms]) {
    const need = VALENCE[atom.el] - usedValence(atom.id, bonds)
    if (need < 0) {
      throw new NameError(
        `Valence exceeded on ${atom.el}`,
        `某顆 ${atom.el} 原子的取代基過多，超出原子價。請檢查編號與取代基。`,
      )
    }
    for (let i = 0; i < need; i += 1) {
      const h = nextId()
      atoms.push({ id: h, el: 'H' })
      bonds.push({ a: atom.id, b: h, order: 1 })
    }
  }

  return {
    atoms,
    bonds,
    chain,
    parsed,
    formula: molecularFormula(atoms),
    condensed: condensedFormula(atoms, bonds, chain, parsed),
    smiles: toSmiles(atoms, bonds, chain, parsed),
  }
}

export function fromIupacName(name: string): Molecule {
  return buildMolecule(parseIupacName(name))
}

export function molecularFormula(atoms: Atom[]): string {
  const count = new Map<Element, number>()
  for (const a of atoms) count.set(a.el, (count.get(a.el) ?? 0) + 1)
  const order: Element[] = ['C', 'H', 'Br', 'Cl', 'F', 'I', 'N', 'O']
  let out = ''
  for (const el of order) {
    const n = count.get(el)
    if (!n) continue
    out += el + (n > 1 ? String(n) : '')
  }
  return out
}

function atomById(atoms: Atom[], id: number): Atom {
  return atoms.find((a) => a.id === id)!
}

function describeBranch(
  start: number,
  parent: number,
  atoms: Atom[],
  bonds: Bond[],
): string {
  const atom = atomById(atoms, start)
  if (atom.el !== 'C' && atom.el !== 'O' && atom.el !== 'N' && atom.el !== 'F' && atom.el !== 'Cl' && atom.el !== 'Br' && atom.el !== 'I') {
    return atom.el
  }
  if (atom.el === 'F' || atom.el === 'Cl' || atom.el === 'Br' || atom.el === 'I') return atom.el === 'Cl' ? 'Cl' : atom.el

  if (atom.el === 'O') {
    const others = neighbors(start, bonds).filter((n) => n.other !== parent)
    const hasH = others.some((n) => atomById(atoms, n.other).el === 'H')
    const carbon = others.find((n) => atomById(atoms, n.other).el === 'C')
    if (hasH && !carbon) return 'OH'
    if (carbon) return 'O' + walkAlkyl(carbon.other, start, atoms, bonds)
    return 'O'
  }

  if (atom.el === 'N') {
    const h = neighbors(start, bonds).filter((n) => atomById(atoms, n.other).el === 'H').length
    if (h === 2) return 'NH2'
    if (h === 1) return 'NH'
    return 'N'
  }

  return walkAlkyl(start, parent, atoms, bonds)
}

function walkAlkyl(start: number, parent: number, atoms: Atom[], bonds: Bond[]): string {
  const parts: string[] = []
  let current = start
  let prev = parent
  while (true) {
    const atom = atomById(atoms, current)
    if (atom.el !== 'C') {
      parts.push(describeBranch(current, prev, atoms, bonds))
      break
    }
    const nexts = neighbors(current, bonds).filter((n) => n.other !== prev)
    const hs = nexts.filter((n) => atomById(atoms, n.other).el === 'H').length
    const heavy = nexts.filter((n) => atomById(atoms, n.other).el !== 'H')
    const continuation = heavy.find((n) => atomById(atoms, n.other).el === 'C')
    const side = heavy.filter((n) => n !== continuation)
    let unit = 'C' + (hs ? 'H' + (hs > 1 ? String(hs) : '') : '')
    for (const s of side) {
      const frag = describeBranch(s.other, current, atoms, bonds)
      unit += frag.length > 2 ? `(${frag})` : frag
    }
    parts.push(unit)
    if (!continuation) break
    prev = current
    current = continuation.other
  }
  return parts.join('')
}

function carbonUnit(
  carbonId: number,
  prev: number | null,
  next: number | null,
  atoms: Atom[],
  bonds: Bond[],
  parsed: ParsedCompound,
  index: number,
): string {
  const nb = neighbors(carbonId, bonds)
  const extras = nb.filter((n) => n.other !== prev && n.other !== next)
  const hCount = extras.filter((n) => atomById(atoms, n.other).el === 'H').length
  const heavy = extras.filter((n) => atomById(atoms, n.other).el !== 'H')

  const oxo = heavy.find((n) => atomById(atoms, n.other).el === 'O' && n.order === 2)
  const singleO = heavy.filter((n) => atomById(atoms, n.other).el === 'O' && n.order === 1)
  const nitrogen = heavy.find((n) => atomById(atoms, n.other).el === 'N')
  const otherHeavy = heavy.filter((n) => n !== oxo && n !== nitrogen && !singleO.includes(n))

  const isCarboxyl = parsed.carboxyls.includes(index + 1)
  const isAmide = parsed.amides.includes(index + 1)
  const isEsterCarbon = Boolean(parsed.esterAlkoxy) && index === 0

  if (isCarboxyl || isAmide || isEsterCarbon) {
    if (isEsterCarbon) {
      const alkoxyO = singleO[0]
      const alkoxy = alkoxyO ? describeBranch(alkoxyO.other, carbonId, atoms, bonds) : 'O'
      if (hCount === 1) return 'HCO' + alkoxy
      return 'CO' + alkoxy
    }
    if (isAmide) return hCount === 1 ? 'HCONH2' : 'CONH2'
    return hCount === 1 ? 'HCOOH' : 'COOH'
  }

  if (oxo && parsed.carbonyls.includes(index + 1) && !isCarboxyl) {
    if (parsed.chainLength === 1) return 'HCHO'
    if (prev === null || next === null) return hCount === 1 ? 'CHO' : 'CO'
    return 'CO'
  }

  const tags: string[] = []
  for (const o of singleO) tags.push(describeBranch(o.other, carbonId, atoms, bonds))
  if (nitrogen) tags.push(describeBranch(nitrogen.other, carbonId, atoms, bonds))
  for (const extra of otherHeavy) tags.push(describeBranch(extra.other, carbonId, atoms, bonds))

  const core = hCount === 3 ? 'CH3' : hCount === 2 ? 'CH2' : hCount === 1 ? 'CH' : 'C'
  if (!tags.length) return core
  if (tags.length === 1) return attachInline(core, tags[0], hCount)
  return `${core}${tags.map((t) => `(${t})`).join('')}`
}

function attachInline(core: string, tag: string, hCount: number): string {
  const compact = tag.length <= 2 && tag !== 'OH' && tag !== 'NH2'
  if (hCount === 3) return compact ? `CH3${tag}` : `CH3(${tag})`
  if (hCount === 2) return compact ? `${core}${tag}` : `${core}(${tag})`
  if (hCount === 1) return compact ? `CH${tag}` : `CH(${tag})`
  if (hCount === 0) return compact ? `C${tag}` : `C(${tag})`
  return core + tag
}

export function condensedFormula(
  atoms: Atom[],
  bonds: Bond[],
  chain: number[],
  parsed: ParsedCompound,
): string {
  const reverse =
    parsed.carboxyls.includes(1) ||
    parsed.amides.includes(1) ||
    Boolean(parsed.esterAlkoxy) ||
    (parsed.series === 'aldehyde' && parsed.carbonyls.includes(1) && parsed.carbonyls.length === 1)

  const order = reverse ? [...chain].reverse() : chain
  const parts: string[] = []

  for (let i = 0; i < order.length; i += 1) {
    const id = order[i]
    const originalIndex = chain.indexOf(id)
    const prev = i > 0 ? order[i - 1] : null
    const next = i < order.length - 1 ? order[i + 1] : null
    const unit = carbonUnit(id, prev, next, atoms, bonds, parsed, originalIndex)
    parts.push(unit)
    if (next !== null) {
      const pb = bonds.find(
        (b) => (b.a === id && b.b === next) || (b.b === id && b.a === next),
      )
      if (pb?.order === 2) parts.push('=')
    }
  }

  let s = parts.join('')
  s = s.replace(/COOH$/,'COOH').replace(/CONH2$/,'CONH2')
  return tidyCondensed(s)
}

function tidyCondensed(s: string): string {
  return s
    .replace(/CH3COOH/, 'CH3COOH')
    .replace(/HCOOH/, 'HCOOH')
    .replace(/CH3CHO/, 'CH3CHO')
    .replace(/HCHO/, 'HCHO')
}

function toSmiles(atoms: Atom[], bonds: Bond[], chain: number[], parsed: ParsedCompound): string {
  const visited = new Set<number>()

  const walk = (id: number, parent: number | null): string => {
    const atom = atomById(atoms, id)
    if (atom.el === 'H') return ''
    visited.add(id)
    const nb = neighbors(id, bonds).filter((n) => n.other !== parent && atomById(atoms, n.other).el !== 'H')
    const symbol = atom.el === 'Cl' ? 'Cl' : atom.el
    if (!nb.length) return symbol

    const chainNext = nb.find((n) => chain.includes(n.other) && !visited.has(n.other))
    const branches = nb.filter((n) => n !== chainNext)
    let out = symbol
    for (const b of branches) {
      const frag = walk(b.other, id)
      if (!frag) continue
      const bond = b.order === 2 ? '=' : ''
      out += `(${bond}${frag})`
    }
    if (chainNext) {
      const bond = chainNext.order === 2 ? '=' : ''
      out += bond + walk(chainNext.other, id)
    }
    return out
  }

  const start = chain[0]
  let smiles = walk(start, null)
  if (parsed.esterAlkoxy) {
    /* already included via oxygen branch */
  }
  return smiles || 'C'
}
