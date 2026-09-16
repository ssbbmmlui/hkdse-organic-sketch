import type { Atom, Bond, Molecule } from './types'

export type Dir = 'N' | 'E' | 'S' | 'W'

export interface Point {
  x: number
  y: number
}

export const DIRS: Dir[] = ['N', 'E', 'S', 'W']

export const VEC: Record<Dir, Point> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
}

export function opposite(d: Dir): Dir {
  return ({ N: 'S', S: 'N', E: 'W', W: 'E' } as const)[d]
}

/** Reflect a layout horizontally so chain locant 1 can sit on the right. */
export function mirrorX(pos: Map<number, Point>): Map<number, Point> {
  const xs = [...pos.values()].map((p) => p.x)
  if (!xs.length) return new Map(pos)
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  const out = new Map<number, Point>()
  for (const [id, p] of pos) out.set(id, { x: min + max - p.x, y: p.y })
  return out
}

export function rightOf(d: Dir): Dir {
  return ({ N: 'E', E: 'S', S: 'W', W: 'N' } as const)[d]
}

export function neighborsOf(id: number, bonds: Bond[]): { other: number; order: 1 | 2 | 3 }[] {
  const out: { other: number; order: 1 | 2 | 3 }[] = []
  for (const b of bonds) {
    if (b.a === id) out.push({ other: b.b, order: b.order })
    else if (b.b === id) out.push({ other: b.a, order: b.order })
  }
  return out
}

function atomMap(atoms: Atom[]): Map<number, Atom> {
  return new Map(atoms.map((a) => [a.id, a]))
}

function sortNeighbors(
  items: { other: number; order: 1 | 2 | 3 }[],
  atoms: Map<number, Atom>,
  chainSet: Set<number>,
): { other: number; order: 1 | 2 | 3 }[] {
  const rank = (id: number, order: number) => {
    const el = atoms.get(id)!.el
    if (el === 'O' && order === 2) return 0
    if (el === 'O') return 1
    if (el === 'N') return 2
    if (el === 'C' && !chainSet.has(id)) return 3
    if (el === 'F' || el === 'Cl' || el === 'Br' || el === 'I') return 4
    if (el === 'H') return 6
    return 5
  }
  return [...items].sort((a, b) => rank(a.other, a.order) - rank(b.other, b.order))
}

function freeDirs(used: Partial<Record<Dir, number>>): Dir[] {
  return DIRS.filter((d) => used[d] === undefined)
}

export interface CompactAlkyl {
  root: number
  parent: number
  label: string
  memberIds: Set<number>
}

export interface CompactAmino {
  nitrogen: number
  parent: number
  memberIds: Set<number>
}

function subscriptNum(n: number): string {
  return String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])
}

/** Textbook alkyl labels: CH₃, C₂H₅, C₃H₇, … */
export function alkylFormulaLabel(carbons: number, hydrogens: number): string {
  if (carbons === 1) return 'CH₃'
  return `C${subscriptNum(carbons)}H${subscriptNum(hydrogens)}`
}

/** Primary –NH₂ on an internal chain carbon, drawn as a compact NH₂ label. */
export function compactAminoGroups(mol: Molecule): CompactAmino[] {
  const atoms = atomMap(mol.atoms)
  const chainSet = new Set(mol.chain)
  const groups: CompactAmino[] = []
  for (const atom of mol.atoms) {
    if (atom.el !== 'N') continue
    const nb = neighborsOf(atom.id, mol.bonds)
    const hs = nb.filter((n) => atoms.get(n.other)!.el === 'H')
    const heavy = nb.filter((n) => atoms.get(n.other)!.el !== 'H')
    if (hs.length !== 2 || heavy.length !== 1) continue
    const parent = heavy[0].other
    if (!chainSet.has(parent)) continue
    const amide = neighborsOf(parent, mol.bonds).some((n) => atoms.get(n.other)!.el === 'O' && n.order === 2)
    if (amide) continue
    const idx = mol.chain.indexOf(parent)
    if (idx <= 0 || idx >= mol.chain.length - 1) continue
    groups.push({
      nitrogen: atom.id,
      parent,
      memberIds: new Set([atom.id, ...hs.map((h) => h.other)]),
    })
  }
  return groups
}

/** Off-chain alkyl groups attached to the main chain (methyl, ethyl, …). */
export function compactAlkylGroups(mol: Molecule): CompactAlkyl[] {
  const atoms = atomMap(mol.atoms)
  const chainSet = new Set(mol.chain)
  const seen = new Set<number>()
  const groups: CompactAlkyl[] = []
  for (const cid of mol.chain) {
    for (const n of neighborsOf(cid, mol.bonds)) {
      if (seen.has(n.other) || atoms.get(n.other)!.el !== 'C' || chainSet.has(n.other)) continue
      const memberIds = new Set<number>()
      const stack = [n.other]
      while (stack.length) {
        const id = stack.pop()!
        if (memberIds.has(id) || chainSet.has(id)) continue
        memberIds.add(id)
        seen.add(id)
        for (const m of neighborsOf(id, mol.bonds)) {
          if (!chainSet.has(m.other) && !memberIds.has(m.other)) stack.push(m.other)
        }
      }
      let carbons = 0
      let hydrogens = 0
      for (const id of memberIds) {
        if (atoms.get(id)!.el === 'C') carbons += 1
        if (atoms.get(id)!.el === 'H') hydrogens += 1
      }
      groups.push({ root: n.other, parent: cid, label: alkylFormulaLabel(carbons, hydrogens), memberIds })
    }
  }
  return groups
}

/** Hydrogens of –CHO that must appear in the skeletal formula. */
export function aldehydeHydrogenIds(mol: Molecule): Set<number> {
  const atoms = atomMap(mol.atoms)
  const ids = new Set<number>()
  for (const carbonId of mol.chain) {
    const nb = neighborsOf(carbonId, mol.bonds)
    const hasOxo = nb.some((n) => atoms.get(n.other)!.el === 'O' && n.order === 2)
    const hasHydroxy = nb.some((n) => atoms.get(n.other)!.el === 'O' && n.order === 1)
    const hasN = nb.some((n) => atoms.get(n.other)!.el === 'N')
    if (!hasOxo || hasHydroxy || hasN) continue
    const carbons = nb.filter((n) => atoms.get(n.other)!.el === 'C')
    const hs = nb.filter((n) => atoms.get(n.other)!.el === 'H')
    if (carbons.length <= 1 && hs.length) {
      for (const h of hs) ids.add(h.other)
    }
  }
  return ids
}

function pickDir(used: Partial<Record<Dir, number>>, prefer: Dir[]): Dir {
  for (const d of prefer) {
    if (used[d] === undefined) return d
  }
  const free = freeDirs(used)
  if (!free.length) return 'N'
  return free[0]
}

/**
 * Place atoms on a rectilinear grid for HKDSE-style displayed formulae.
 */
export function layoutStructural(mol: Molecule, bond = 36): Map<number, Point> {
  const pos = new Map<number, Point>()
  const atoms = atomMap(mol.atoms)
  const chainSet = new Set(mol.chain)
  const incoming = new Map<number, Dir>()
  const assigned = new Set<number>()
  const occ = new Map<string, number>()
  /** Every structural bond matches the C–H length. */
  const link = bond * 0.78
  const cellKey = (p: Point) => `${Math.round(p.x / link)},${Math.round(p.y / link)}`
  const alkyls = compactAlkylGroups(mol)
  const alkylByRoot = new Map(alkyls.map((g) => [g.root, g]))
  const aminos = compactAminoGroups(mol)
  const aminoByN = new Map(aminos.map((g) => [g.nitrogen, g]))

  const reserve = (id: number, p: Point) => occ.set(cellKey(p), id)

  mol.chain.forEach((id, i) => {
    const p = { x: i * link, y: 0 }
    pos.set(id, p)
    assigned.add(id)
    reserve(id, p)
    if (i > 0) incoming.set(id, 'W')
  })

  const target = (parent: number, dir: Dir, length: number): Point => {
    const p = pos.get(parent)!
    const v = VEC[dir]
    return { x: p.x + v.x * length, y: p.y + v.y * length }
  }

  const freeDir = (used: Partial<Record<Dir, number>>, prefer: Dir[], parent: number, length: number): Dir => {
    const ordered = [...prefer, ...DIRS.filter((d) => !prefer.includes(d))]
    for (const d of ordered) {
      if (used[d] !== undefined) continue
      const owner = occ.get(cellKey(target(parent, d, length)))
      if (owner !== undefined && owner !== parent) continue
      return d
    }
    return pickDir(used, prefer)
  }

  const placeFrom = (parent: number, child: number, dir: Dir, length = link) => {
    const p = target(parent, dir, length)
    pos.set(child, p)
    reserve(child, p)
    incoming.set(child, opposite(dir))
    assigned.add(child)
  }

  const usedAt = (id: number): Partial<Record<Dir, number>> => {
    const used: Partial<Record<Dir, number>> = {}
    const from = incoming.get(id)
    if (from !== undefined) used[from] = -1
    const idx = mol.chain.indexOf(id)
    if (idx !== -1) {
      if (idx > 0) used.W = mol.chain[idx - 1]
      if (idx < mol.chain.length - 1) used.E = mol.chain[idx + 1]
    }
    for (const n of neighborsOf(id, mol.bonds)) {
      if (!pos.has(n.other)) continue
      const a = pos.get(id)!
      const b = pos.get(n.other)!
      const dx = b.x - a.x
      const dy = b.y - a.y
      if (Math.abs(dx) >= Math.abs(dy)) used[dx >= 0 ? 'E' : 'W'] = n.other
      else used[dy >= 0 ? 'S' : 'N'] = n.other
    }
    return used
  }

  const preferDir = (
    id: number,
    n: { other: number; order: 1 | 2 | 3 },
    pending: { other: number; order: 1 | 2 | 3 }[],
  ): Dir[] => {
    const el = atoms.get(n.other)!.el
    const parentEl = atoms.get(id)!.el
    const incomingDir = incoming.get(id)
    const idx = mol.chain.indexOf(id)
    const hasOxo =
      pending.some((x) => atoms.get(x.other)!.el === 'O' && x.order === 2) ||
      neighborsOf(id, mol.bonds).some((x) => atoms.get(x.other)!.el === 'O' && x.order === 2)
    const parentHasDouble = neighborsOf(id, mol.bonds).some((x) => x.order === 2)
    const vertical: Dir[] = idx !== -1 && idx % 2 === 0 ? ['N', 'S'] : ['S', 'N']
    if (el === 'O' && n.order === 2) return ['N', 'S']
    if (el === 'O' && n.order === 1 && hasOxo) return ['W', 'E']
    if (el === 'H' && hasOxo) return ['W', 'E']
    if (el === 'N') return ['W', 'E', 'S', 'N']
    if (el === 'O') return ['S', 'N', 'W', 'E']
    if (el === 'C' && (parentEl === 'O' || parentEl === 'N') && incomingDir) {
      return [opposite(incomingDir), 'W', 'E', 'N', 'S']
    }
    if (el === 'C' && incomingDir && !chainSet.has(id)) {
      return [opposite(incomingDir), 'E', 'W', 'N', 'S']
    }
    if (el === 'C') return [...vertical, 'W', 'E']
    if (el === 'H' && parentEl === 'N') return ['W', 'E', 'N', 'S']
    if (el === 'H' && parentHasDouble) return ['W', 'E', 'N', 'S']
    if (el === 'H') return ['N', 'S', 'W', 'E']
    return ['N', 'S', 'W', 'E']
  }

  const placePending = (id: number, pending: { other: number; order: 1 | 2 | 3 }[]) => {
    const used = usedAt(id)
    for (const n of pending) {
      const alkyl = alkylByRoot.get(n.other)
      const amino = aminoByN.get(n.other)
      const dir = freeDir(used, preferDir(id, n, pending), id, link)
      used[dir] = n.other
      placeFrom(id, n.other, dir, link)
      if (alkyl) {
        for (const mid of alkyl.memberIds) assigned.add(mid)
      }
      if (amino) {
        for (const mid of amino.memberIds) {
          if (mid !== amino.nitrogen) assigned.add(mid)
        }
      }
    }
  }

  const walkHeavy = (id: number) => {
    const pending = sortNeighbors(
      neighborsOf(id, mol.bonds).filter((n) => !assigned.has(n.other) && atoms.get(n.other)!.el !== 'H'),
      atoms,
      chainSet,
    )
    placePending(id, pending)
    for (const n of pending) {
      if (!alkylByRoot.has(n.other)) walkHeavy(n.other)
    }
  }

  const walkHydrogens = (id: number) => {
    const pending = sortNeighbors(
      neighborsOf(id, mol.bonds).filter((n) => !assigned.has(n.other) && atoms.get(n.other)!.el === 'H'),
      atoms,
      chainSet,
    )
    placePending(id, pending)
  }

  for (const id of mol.chain) walkHeavy(id)

  const hydrogenParents = mol.atoms
    .filter((a) => a.el !== 'H' && pos.has(a.id))
    .sort((a, b) => Number(b.el === 'N') - Number(a.el === 'N'))
  for (const atom of hydrogenParents) walkHydrogens(atom.id)

  for (const atom of mol.atoms) {
    if (assigned.has(atom.id) || pos.has(atom.id)) continue
    const nb = neighborsOf(atom.id, mol.bonds).find((n) => pos.has(n.other))
    if (nb) placeFrom(nb.other, atom.id, 'S')
    else pos.set(atom.id, { x: 0, y: 0 })
  }

  return pos
}

/**
 * Zig-zag skeletal coordinates for the carbon skeleton and attached heteroatoms.
 */
export function layoutSkeletal(mol: Molecule, bond = 34): Map<number, Point> {
  const pos = new Map<number, Point>()
  const atoms = atomMap(mol.atoms)
  const assigned = new Set<number>()
  const ang = (Math.PI / 180) * 30

  let x = 0
  let y = 0
  mol.chain.forEach((id, i) => {
    if (i === 0) {
      pos.set(id, { x, y })
    } else {
      const sign = i % 2 === 1 ? -1 : 1
      x += bond * Math.cos(ang)
      y += sign * bond * Math.sin(ang)
      pos.set(id, { x, y })
    }
    assigned.add(id)
  })

  const placePolar = (parent: number, child: number, angle: number, length: number) => {
    const p = pos.get(parent)!
    pos.set(child, { x: p.x + Math.cos(angle) * length, y: p.y + Math.sin(angle) * length })
    assigned.add(child)
  }

  const chainAngle = (i: number): number => {
    if (i <= 0) return Math.PI + (mol.chain.length > 1 ? -ang : 0)
    const a = pos.get(mol.chain[i])!
    const b = pos.get(mol.chain[i - 1])!
    return Math.atan2(a.y - b.y, a.x - b.x)
  }

  const nextChainAngle = (i: number): number | null => {
    if (i >= mol.chain.length - 1) return null
    const a = pos.get(mol.chain[i])!
    const b = pos.get(mol.chain[i + 1])!
    return Math.atan2(b.y - a.y, b.x - a.x)
  }

  const leaveAngle = (fromIdx: number): number => {
    const sign = (fromIdx + 1) % 2 === 1 ? -1 : 1
    return sign * ang
  }

  /** Direction from a terminal carbon toward the missing zigzag neighbour, so the atom stays a vertex. */
  const zigzagContinuation = (i: number): number => {
    const n = mol.chain.length
    if (i === 0) return leaveAngle(-1) + Math.PI
    if (i === n - 1) return leaveAngle(i)
    return convexAngle(mol.chain[i]) ?? -Math.PI / 2
  }

  const convexAngle = (carbonId: number): number | null => {
    const i = mol.chain.indexOf(carbonId)
    if (i === -1) return null
    const cur = pos.get(carbonId)!
    let vx = 0
    let vy = 0
    const addPoint = (p: Point) => {
      const d = Math.hypot(p.x - cur.x, p.y - cur.y) || 1
      vx += (p.x - cur.x) / d
      vy += (p.y - cur.y) / d
    }
    const addId = (other: number) => addPoint(pos.get(other)!)
    if (i > 0) addId(mol.chain[i - 1])
    else if (mol.chain.length > 1) {
      const a = zigzagContinuation(0)
      addPoint({ x: cur.x + Math.cos(a) * bond, y: cur.y + Math.sin(a) * bond })
    }
    if (i < mol.chain.length - 1) addId(mol.chain[i + 1])
    else if (mol.chain.length > 1) {
      const a = zigzagContinuation(i)
      addPoint({ x: cur.x + Math.cos(a) * bond, y: cur.y + Math.sin(a) * bond })
    }
    if (vx === 0 && vy === 0) return -Math.PI / 2
    return Math.atan2(-vy, -vx)
  }

  const aldehydeHs = aldehydeHydrogenIds(mol)

  const walk = (id: number, from: number | null, arriveAngle: number) => {
    const pending = neighborsOf(id, mol.bonds).filter((n) => {
      if (assigned.has(n.other)) return false
      const el = atoms.get(n.other)!.el
      return el !== 'H' || aldehydeHs.has(n.other)
    })
    const idx = mol.chain.indexOf(id)
    const usedAngles: number[] = []
    if (from !== null) usedAngles.push(arriveAngle + Math.PI)

    if (idx !== -1) {
      const forward = nextChainAngle(idx)
      if (forward !== null) usedAngles.push(forward)
      if (idx > 0) usedAngles.push(chainAngle(idx) + Math.PI)
    }

    const angleDelta = (a: number, b: number) =>
      Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

    const taken = (angle: number) => usedAngles.some((u) => angleDelta(angle, u) < 0.45)
    const colinear = (angle: number) => usedAngles.some((u) => angleDelta(angle, u) > Math.PI - 0.4)
    const ok = (angle: number) => !taken(angle) && !colinear(angle)

    /** ±120° from the incoming bond so this carbon stays a vertex, never a 180° line. */
    const turnAngles = (arrive: number) => {
      const back = arrive + Math.PI
      const a = back + (2 * Math.PI) / 3
      const b = back - (2 * Math.PI) / 3
      return [a, b].sort((x, y) => Math.abs(Math.sin(x)) - Math.abs(Math.sin(y)))
    }

    for (const n of sortNeighbors(pending, atoms, new Set(mol.chain))) {
      const el = atoms.get(n.other)!.el
      const carbonyl = el === 'O' && n.order === 2
      const hydroxyl = el === 'O' && n.order === 1
      const amino = el === 'N'
      const aldehydeH = el === 'H' && aldehydeHs.has(n.other)
      const halogen = el === 'F' || el === 'Cl' || el === 'Br' || el === 'I'
      const alkylBranch = el === 'C' && !mol.chain.includes(n.other)
      const terminal = idx === 0 || idx === mol.chain.length - 1
      const convex = idx !== -1 ? convexAngle(id) : null
      const continuation = terminal && idx !== -1 ? zigzagContinuation(idx) : null
      const methanoicCarboxyl =
        mol.chain.length === 1 && mol.parsed.carboxyls.includes(1) && !mol.parsed.esterAlkoxy
      let chosen: number
      if (methanoicCarboxyl && carbonyl) {
        // Textbook HCOOH hook: vertical C=O, not a 120° V with OH.
        chosen = -Math.PI / 2
      } else if (methanoicCarboxyl && hydroxyl) {
        chosen = Math.PI / 6
      } else if (carbonyl && convex !== null && ok(convex)) {
        chosen = convex
      } else if (aldehydeH && mol.chain.length === 1) {
        // Methanal: 120° V with H left and right, not a horizontal H—C—H line.
        const oxo = convex ?? -Math.PI / 2
        const vArms = [oxo - (2 * Math.PI) / 3, oxo + (2 * Math.PI) / 3]
        chosen = vArms.find((a) => ok(a) || !taken(a)) ?? vArms[0]
      } else if ((hydroxyl || aldehydeH) && continuation !== null && ok(continuation)) {
        chosen = continuation
      } else if ((hydroxyl || amino || aldehydeH) && convex !== null && ok(convex)) {
        chosen = convex
      } else if ((halogen || alkylBranch || amino || hydroxyl) && idx !== -1) {
        const extras = convex !== null ? [convex + Math.PI / 3, convex - Math.PI / 3] : []
        const preferred = [
          ...(convex !== null ? [convex] : []),
          ...(terminal && continuation !== null ? [continuation] : []),
        ]
        chosen =
          preferred.find((a) => ok(a)) ??
          extras.find((a) => !taken(a)) ??
          turnAngles(arriveAngle).find((a) => ok(a)) ??
          preferred[0] ??
          arriveAngle + Math.PI
      } else if (idx === -1) {
        chosen = turnAngles(arriveAngle).find((a) => ok(a)) ?? turnAngles(arriveAngle)[0]
      } else {
        const base = convex ?? continuation ?? arriveAngle + Math.PI
        chosen =
          [base, base + (2 * Math.PI) / 3, base - (2 * Math.PI) / 3].find((a) => ok(a)) ??
          turnAngles(arriveAngle)[0]
      }
      usedAngles.push(chosen)
      placePolar(id, n.other, chosen, bond)
      walk(n.other, id, chosen)
    }
  }

  mol.chain.forEach((id, i) => {
    const arrive = i === 0 ? Math.PI : chainAngle(i)
    walk(id, i === 0 ? null : mol.chain[i - 1], arrive)
  })

  for (const atom of mol.atoms) {
    if (atom.el === 'H') continue
    if (!pos.has(atom.id)) {
      const nb = neighborsOf(atom.id, mol.bonds).find((n) => pos.has(n.other))
      if (nb) {
        const p = pos.get(nb.other)!
        pos.set(atom.id, { x: p.x, y: p.y + bond })
      }
    }
  }

  return pos
}

export function bounds(points: Iterable<Point>, pad = 28): { minX: number; minY: number; width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, width: 120, height: 80 }
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}
