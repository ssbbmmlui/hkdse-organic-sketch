import { describe, expect, it } from 'vitest'
import { compactAlkylGroups, compactAminoGroups, layoutSkeletal, layoutStructural, mirrorX } from './layout'
import { fromIupacName } from './molecule'
import { renderSkeletalSvg, renderStructuralSvg } from './render'

describe('formula layout', () => {
  it('puts skeletal OH on the convex side of C2 in propan-2-ol', () => {
    const mol = fromIupacName('propan-2-ol')
    const pos = layoutSkeletal(mol)
    const c2 = pos.get(mol.chain[1])!
    const oxygen = mol.atoms.find((a) => a.el === 'O')!
    const oh = pos.get(oxygen.id)!
    expect(oh.y).toBeLessThan(c2.y)
  })

  it('makes terminal carbons turn in hexanedioic acid skeletal formula', () => {
    const mol = fromIupacName('hexanedioic acid')
    const pos = layoutSkeletal(mol)
    const oxygenAt = (carbonId: number) =>
      mol.atoms.find((a) => {
        if (a.el !== 'O') return false
        return mol.bonds.some(
          (b) =>
            b.order === 1 &&
            ((b.a === a.id && b.b === carbonId) || (b.b === a.id && b.a === carbonId)),
        )
      })!

    const angleAt = (left: number, vertex: number, right: number) => {
      const v = pos.get(vertex)!
      const a = pos.get(left)!
      const b = pos.get(right)!
      const a1 = Math.atan2(a.y - v.y, a.x - v.x)
      const a2 = Math.atan2(b.y - v.y, b.x - v.x)
      return (Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) * 180) / Math.PI
    }

    const c1 = mol.chain[0]
    const c6 = mol.chain[5]
    const turn1 = angleAt(mol.chain[1], c1, oxygenAt(c1).id)
    const turn6 = angleAt(mol.chain[4], c6, oxygenAt(c6).id)
    expect(turn1).toBeGreaterThan(90)
    expect(turn1).toBeLessThan(150)
    expect(turn6).toBeGreaterThan(90)
    expect(turn6).toBeLessThan(150)
  })

  it('points the left carbonyl of hexanedioic acid toward the convex (down)', () => {
    const mol = fromIupacName('hexanedioic acid')
    const pos = layoutSkeletal(mol)
    const c1 = mol.chain[0]
    const oxo = mol.atoms.find((a) => {
      if (a.el !== 'O') return false
      return mol.bonds.some(
        (b) =>
          b.order === 2 &&
          ((b.a === a.id && b.b === c1) || (b.b === a.id && b.a === c1)),
      )
    })!
    expect(pos.get(oxo.id)!.y).toBeGreaterThan(pos.get(c1)!.y)
  })

  it('puts the aldehyde hydrogen on the left in the structural formula', () => {
    const mol = fromIupacName('hexanal')
    const pos = layoutStructural(mol)
    const c1 = pos.get(mol.chain[0])!
    const hs = mol.atoms.filter((a) => a.el === 'H' && mol.bonds.some((b) => b.a === a.id || b.b === a.id))
    const aldehydeH = hs
      .map((a) => pos.get(a.id)!)
      .find((p) => Math.abs(p.y - c1.y) < 8 && p.x < c1.x)
    expect(aldehydeH).toBeDefined()
  })

  it('puts both methanal hydrogens left and right of the carbon', () => {
    const mol = fromIupacName('methanal')
    const c1 = mol.chain[0]
    const hs = mol.atoms.filter(
      (a) =>
        a.el === 'H' &&
        mol.bonds.some((b) => (b.a === a.id && b.b === c1) || (b.b === a.id && b.a === c1)),
    )
    expect(hs).toHaveLength(2)

    const st = layoutStructural(mol)
    const sc = st.get(c1)!
    const stLeft = hs.map((a) => st.get(a.id)!).find((p) => p.x < sc.x && Math.abs(p.y - sc.y) < 8)
    const stRight = hs.map((a) => st.get(a.id)!).find((p) => p.x > sc.x && Math.abs(p.y - sc.y) < 8)
    expect(stLeft).toBeDefined()
    expect(stRight).toBeDefined()

    const sk = layoutSkeletal(mol)
    const kc = sk.get(c1)!
    const hpos = hs.map((a) => sk.get(a.id)!)
    const left = hpos.find((p) => p.x < kc.x)
    const right = hpos.find((p) => p.x > kc.x)
    expect(left).toBeDefined()
    expect(right).toBeDefined()
    expect(left!.y).toBeGreaterThan(kc.y + 8)
    expect(right!.y).toBeGreaterThan(kc.y + 8)
    const a1 = Math.atan2(left!.y - kc.y, left!.x - kc.x)
    const a2 = Math.atan2(right!.y - kc.y, right!.x - kc.x)
    const hch = (Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) * 180) / Math.PI
    expect(hch).toBeGreaterThan(100)
    expect(hch).toBeLessThan(140)
  })

  it('aims the skeletal C–N bond at the nitrogen letter of NH₂', () => {
    const mol = fromIupacName('propane-1,3-diamine')
    const pos = layoutSkeletal(mol)
    const svg = renderSkeletalSvg(mol)
    const nitrogens = mol.atoms.filter((a) => a.el === 'N')
    expect(nitrogens).toHaveLength(2)
    expect(svg).not.toContain('>NH')
    expect(svg).not.toContain('>H₂N')
    for (const n of nitrogens) {
      const p = pos.get(n.id)!
      expect(svg).toContain(`x="${p.x}" y="${p.y}" class="atom hetero N">N</text>`)
    }
  })

  it('includes the aldehyde hydrogen in the skeletal formula', () => {
    const mol = fromIupacName('hexanal')
    const pos = layoutSkeletal(mol)
    const c1 = mol.chain[0]
    const h = mol.atoms.find((a) => {
      if (a.el !== 'H') return false
      return mol.bonds.some((b) => (b.a === a.id && b.b === c1) || (b.b === a.id && b.a === c1))
    })!
    expect(pos.has(h.id)).toBe(true)
    expect(pos.get(h.id)!.x).toBeLessThan(pos.get(c1)!.x)
  })

  it('places amide and amine hydrogens left or right of nitrogen, not below', () => {
    const aminoHydrogens = (mol: ReturnType<typeof fromIupacName>, nId: number) =>
      mol.atoms.filter((a) => {
        if (a.el !== 'H') return false
        return mol.bonds.some((b) => (b.a === a.id && b.b === nId) || (b.b === a.id && b.a === nId))
      })

    for (const name of ['ethanamide', 'methanamide', 'ethanamine', 'propan-1-amine']) {
      const mol = fromIupacName(name)
      const pos = layoutStructural(mol)
      const n = mol.atoms.find((a) => a.el === 'N')!
      const np = pos.get(n.id)!
      const hs = aminoHydrogens(mol, n.id)
      expect(hs.length).toBe(2)
      for (const h of hs) {
        const hp = pos.get(h.id)!
        const below = hp.y > np.y + 4 && Math.abs(hp.x - np.x) < 4
        expect(below, `${name} has an N–H below nitrogen`).toBe(false)
      }
      expect(
        hs.some((h) => Math.abs(pos.get(h.id)!.y - np.y) < 4),
        `${name} should have at least one N–H to the left or right`,
      ).toBe(true)
    }
  })

  it('draws amide, amine and ester groups horizontally in the structural formula', () => {
    const sameRow = (name: string, pick: (mol: ReturnType<typeof fromIupacName>) => number) => {
      const mol = fromIupacName(name)
      const pos = layoutStructural(mol)
      const c1 = pos.get(mol.chain[0])!
      const p = pos.get(pick(mol))!
      expect(Math.abs(p.y - c1.y)).toBeLessThan(8)
      expect(Math.abs(p.x - c1.x)).toBeGreaterThan(20)
    }
    sameRow('ethanamide', (mol) => mol.atoms.find((a) => a.el === 'N')!.id)
    sameRow('ethanamine', (mol) => mol.atoms.find((a) => a.el === 'N')!.id)
    sameRow('ethyl ethanoate', (mol) => {
      const c1 = mol.chain[0]
      return mol.atoms.find((a) => {
        if (a.el !== 'O') return false
        return mol.bonds.some(
          (b) =>
            b.order === 1 &&
            ((b.a === a.id && b.b === c1) || (b.b === a.id && b.a === c1)),
        )
      })!.id
    })
  })

  it('makes a 120° turn from the chain to a mid-chain halogen', () => {
    const angleBetween = (
      vertex: { x: number; y: number },
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      const a1 = Math.atan2(a.y - vertex.y, a.x - vertex.x)
      const a2 = Math.atan2(b.y - vertex.y, b.x - vertex.x)
      return (Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) * 180) / Math.PI
    }

    const butane = fromIupacName('2-bromobutane')
    const butanePos = layoutSkeletal(butane)
    const br = butane.atoms.find((a) => a.el === 'Br')!.id
    const turn = angleBetween(
      butanePos.get(butane.chain[1])!,
      butanePos.get(butane.chain[0])!,
      butanePos.get(br)!,
    )
    expect(turn).toBeGreaterThan(100)
    expect(turn).toBeLessThan(150)

    const geminal = fromIupacName('2,2-dichlorobutane')
    const gemPos = layoutSkeletal(geminal)
    const gemC = gemPos.get(geminal.chain[1])!
    const chlorines = geminal.atoms.filter((a) => a.el === 'Cl').map((a) => gemPos.get(a.id)!)
    const clAngle = angleBetween(gemC, chlorines[0], chlorines[1])
    expect(clAngle).toBeGreaterThan(40)
    expect(clAngle).toBeLessThan(150)
  })

  it('places geminal skeletal NH₂ off the same vertex, not on a chain bond', () => {
    const angleBetween = (
      vertex: { x: number; y: number },
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      const a1 = Math.atan2(a.y - vertex.y, a.x - vertex.x)
      const a2 = Math.atan2(b.y - vertex.y, b.x - vertex.x)
      return (Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) * 180) / Math.PI
    }

    const mol = fromIupacName('pentane-2,2-diamine')
    const pos = layoutSkeletal(mol)
    const c1 = pos.get(mol.chain[0])!
    const c2 = pos.get(mol.chain[1])!
    const c3 = pos.get(mol.chain[2])!
    const nitrogens = mol.atoms.filter((a) => a.el === 'N').map((a) => pos.get(a.id)!)
    expect(nitrogens).toHaveLength(2)
    expect(angleBetween(c2, nitrogens[0], nitrogens[1])).toBeGreaterThan(40)
    expect(angleBetween(c2, nitrogens[0], nitrogens[1])).toBeLessThan(90)
    for (const n of nitrogens) {
      expect(angleBetween(c2, n, c1)).toBeGreaterThan(25)
      expect(angleBetween(c2, n, c3)).toBeGreaterThan(25)
    }
  })

  it('keeps branched structural formulae from overlapping and turns every skeletal carbon', () => {
    const angleBetween = (
      vertex: { x: number; y: number },
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      const a1 = Math.atan2(a.y - vertex.y, a.x - vertex.x)
      const a2 = Math.atan2(b.y - vertex.y, b.x - vertex.x)
      return (Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) * 180) / Math.PI
    }

    const mol = fromIupacName('3-ethyl-2-methylpentane')
    const st = layoutStructural(mol)
    const heavies = mol.atoms.filter((a) => a.el !== 'H' && st.has(a.id))
    for (let i = 0; i < heavies.length; i += 1) {
      for (let j = i + 1; j < heavies.length; j += 1) {
        const a = st.get(heavies[i].id)!
        const b = st.get(heavies[j].id)!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(16)
      }
    }

    const c2 = mol.chain[1]
    const c3 = mol.chain[2]
    const branchOf = (carbonId: number) =>
      mol.atoms.find((a) => {
        if (a.el !== 'C' || mol.chain.includes(a.id)) return false
        return mol.bonds.some((b) => (b.a === a.id && b.b === carbonId) || (b.b === a.id && b.a === carbonId))
      })!
    const methyl = st.get(branchOf(c2).id)!
    const ethyl = st.get(branchOf(c3).id)!
    expect(Math.sign(methyl.y - st.get(c2)!.y)).not.toBe(Math.sign(ethyl.y - st.get(c3)!.y))

    const sk = layoutSkeletal(mol)
    for (const atom of mol.atoms) {
      if (atom.el === 'H') continue
      const nbs = mol.bonds
        .filter((b) => b.a === atom.id || b.b === atom.id)
        .map((b) => (b.a === atom.id ? b.b : b.a))
        .filter((id) => mol.atoms.find((a) => a.id === id)!.el !== 'H' && sk.has(id))
      for (let i = 0; i < nbs.length; i += 1) {
        for (let j = i + 1; j < nbs.length; j += 1) {
          const ang = angleBetween(sk.get(atom.id)!, sk.get(nbs[i])!, sk.get(nbs[j])!)
          expect(ang).toBeGreaterThan(50)
          expect(ang).toBeLessThan(155)
        }
      }
    }
  })

  it('gives every structural bond the same length as C–H', () => {
    const mol = fromIupacName('3-ethyl-2,2-dimethylpentane')
    const pos = layoutStructural(mol)
    const dist = (a: number, b: number) => {
      const p = pos.get(a)!
      const q = pos.get(b)!
      return Math.hypot(p.x - q.x, p.y - q.y)
    }
    const c1 = mol.chain[0]
    const h = mol.atoms.find(
      (a) =>
        a.el === 'H' &&
        mol.bonds.some((b) => (b.a === a.id && b.b === c1) || (b.b === a.id && b.a === c1)),
    )!
    const ch = dist(c1, h.id)
    expect(ch).toBeLessThan(32)
    expect(ch).toBeGreaterThan(24)
    expect(dist(mol.chain[0], mol.chain[1])).toBeCloseTo(ch, 5)
    const alkyls = compactAlkylGroups(mol)
    for (const g of alkyls) {
      expect(dist(g.parent, g.root)).toBeCloseTo(ch, 5)
    }
  })

  it('writes a crowded C2 amine as compact NH₂ like an alkyl', () => {
    const mol = fromIupacName('butane-1,2-diamine')
    const groups = compactAminoGroups(mol)
    expect(groups).toHaveLength(1)
    expect(groups[0].parent).toBe(mol.chain[1])
    const pos = layoutStructural(mol)
    const n2 = groups[0].nitrogen
    expect(pos.has(n2)).toBe(true)
    for (const id of groups[0].memberIds) {
      if (id !== n2) expect(pos.has(id)).toBe(false)
    }
    const c1n = mol.atoms.find((a) => {
      if (a.el !== 'N' || a.id === n2) return false
      return mol.bonds.some((b) => (b.a === a.id && b.b === mol.chain[0]) || (b.b === a.id && b.a === mol.chain[0]))
    })!
    const terminalHs = mol.atoms.filter((a) => {
      if (a.el !== 'H') return false
      return mol.bonds.some((b) => (b.a === a.id && b.b === c1n.id) || (b.b === a.id && b.a === c1n.id))
    })
    expect(terminalHs).toHaveLength(2)
    for (const h of terminalHs) expect(pos.has(h.id)).toBe(true)
    const svg = renderStructuralSvg(mol)
    const np = pos.get(n2)!
    expect(svg).toContain(`x="${np.x}" y="${np.y}" dy="1.6" class="atom hetero N">N</text>`)
    expect(svg).toContain('>2</tspan>')
  })

  it('writes crowded alkyls as CH₃ and C₂H₅ on the structural formula', () => {
    const mol = fromIupacName('3-ethyl-2,2-dimethylpentane')
    const groups = compactAlkylGroups(mol)
    expect(groups.filter((g) => g.label === 'CH₃')).toHaveLength(2)
    expect(groups.filter((g) => g.label === 'C₂H₅')).toHaveLength(1)
    const svg = renderStructuralSvg(mol, true)
    expect(svg).toContain('>C</text>')
    expect(svg).toContain('class="sub"')
    expect(svg).toContain('>3</tspan>')
    expect(svg).toContain('>5</tspan>')
    const pos = layoutStructural(mol)
    const roots = groups.map((g) => pos.get(g.root)!)
    for (let i = 0; i < roots.length; i += 1) {
      for (let j = i + 1; j < roots.length; j += 1) {
        expect(Math.hypot(roots[i].x - roots[j].x, roots[i].y - roots[j].y)).toBeGreaterThan(16)
      }
    }
  })

  it('points Cl down on the same carbon as terminal OH, not 180° from HO', () => {
    const mol = fromIupacName('1-chlorobut-2-en-1-ol')
    const pos = layoutSkeletal(mol)
    const c1 = pos.get(mol.chain[0])!
    const oxygen = mol.atoms.find((a) => a.el === 'O')!
    const chlorine = mol.atoms.find((a) => a.el === 'Cl')!
    const cl = pos.get(chlorine.id)!
    const oh = pos.get(oxygen.id)!
    expect(cl.y).toBeGreaterThan(c1.y)
    const a1 = Math.atan2(oh.y - c1.y, oh.x - c1.x)
    const a2 = Math.atan2(cl.y - c1.y, cl.x - c1.x)
    const sep = (Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) * 180) / Math.PI
    expect(sep).toBeGreaterThan(100)
    expect(sep).toBeLessThan(150)
  })

  it('draws skeletal C=C as a main chain line plus a shorter offset stroke', () => {
    const mol = fromIupacName('hex-1-ene')
    const svg = renderSkeletalSvg(mol)
    const pos = layoutSkeletal(mol)
    const c1 = pos.get(mol.chain[0])!
    const c2 = pos.get(mol.chain[1])!
    const lines = [...svg.matchAll(/x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map((m) => ({
      x1: Number(m[1]),
      y1: Number(m[2]),
      x2: Number(m[3]),
      y2: Number(m[4]),
    }))
    const len = (l: { x1: number; y1: number; x2: number; y2: number }) =>
      Math.hypot(l.x2 - l.x1, l.y2 - l.y1)
    const near = (p: { x: number; y: number }, x: number, y: number) => Math.hypot(p.x - x, p.y - y) < 1.2
    const main = lines.find(
      (l) =>
        (near(c1, l.x1, l.y1) && near(c2, l.x2, l.y2)) || (near(c1, l.x2, l.y2) && near(c2, l.x1, l.y1)),
    )
    expect(main).toBeDefined()
    const offset = lines.find((l) => {
      if (l === main) return false
      const midX = (l.x1 + l.x2) / 2
      const midY = (l.y1 + l.y2) / 2
      const axisX = (c1.x + c2.x) / 2
      const axisY = (c1.y + c2.y) / 2
      return Math.hypot(midX - axisX, midY - axisY) > 2 && Math.hypot(midX - axisX, midY - axisY) < 8 && len(l) < len(main!) - 4
    })
    expect(offset).toBeDefined()
  })

  it('joins skeletal bonds through every non-terminal carbon of 2-methylpentanoic acid', () => {
    const mol = fromIupacName('2-methylpentanoic acid')
    const svg = renderSkeletalSvg(mol)
    const pos = layoutSkeletal(mol)
    const lines = [...svg.matchAll(/x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map((m) => ({
      x1: Number(m[1]),
      y1: Number(m[2]),
      x2: Number(m[3]),
      y2: Number(m[4]),
    }))
    const near = (p: { x: number; y: number }, x: number, y: number) => Math.hypot(p.x - x, p.y - y) < 1.2
    for (const id of mol.chain) {
      const p = pos.get(id)!
      const hits = lines.filter((l) => near(p, l.x1, l.y1) || near(p, l.x2, l.y2)).length
      const terminal = id === mol.chain[mol.chain.length - 1]
      if (terminal) expect(hits).toBeGreaterThanOrEqual(1)
      else expect(hits, `carbon ${id} should be a shared vertex`).toBeGreaterThanOrEqual(2)
    }
    expect(svg).toContain('class="vertex"')
  })

  it('attaches skeletal C=O as two strokes on the left and right of the carbon tip', () => {
    const mol = fromIupacName('2-methylpentanoic acid')
    const svg = renderSkeletalSvg(mol)
    const pos = layoutSkeletal(mol)
    const c1 = pos.get(mol.chain[0])!
    const oxo = mol.atoms.find(
      (a) =>
        a.el === 'O' &&
        mol.bonds.some((b) => b.order === 2 && ((b.a === a.id && b.b === mol.chain[0]) || (b.b === a.id && b.a === mol.chain[0]))),
    )!
    const o = pos.get(oxo.id)!
    const lines = [...svg.matchAll(/x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map((m) => ({
      x1: Number(m[1]),
      y1: Number(m[2]),
      x2: Number(m[3]),
      y2: Number(m[4]),
    }))
    const near = (p: { x: number; y: number }, x: number, y: number, r = 2.2) => Math.hypot(p.x - x, p.y - y) < r
    const oxoLines = lines.filter((l) => {
      const aNearC = near(c1, l.x1, l.y1)
      const bNearC = near(c1, l.x2, l.y2)
      const aNearO = near(o, l.x1, l.y1, 12)
      const bNearO = near(o, l.x2, l.y2, 12)
      return (aNearC && bNearO) || (bNearC && aNearO)
    })
    expect(oxoLines.length).toBe(2)
    expect(
      oxoLines.some((l) => near(c1, l.x1, l.y1, 0.4) && near(o, l.x2, l.y2, 0.4)),
    ).toBe(false)
    const dir = (l: (typeof oxoLines)[number]) => {
      const x = l.x2 - l.x1
      const y = l.y2 - l.y1
      const n = Math.hypot(x, y) || 1
      return { x: x / n, y: y / n }
    }
    const a = dir(oxoLines[0])
    const b = dir(oxoLines[1])
    expect(Math.abs(a.x * b.x + a.y * b.y)).toBeGreaterThan(0.999)
  })

  it('places hydrogens on alkene carbons left or right, not below', () => {
    const alkeneCarbons = (mol: ReturnType<typeof fromIupacName>) =>
      mol.atoms.filter(
        (a) => a.el === 'C' && mol.bonds.some((b) => b.order === 2 && (b.a === a.id || b.b === a.id)),
      )
    const hydrogensOn = (mol: ReturnType<typeof fromIupacName>, carbonId: number) =>
      mol.atoms.filter(
        (a) =>
          a.el === 'H' &&
          mol.bonds.some((b) => (b.a === a.id && b.b === carbonId) || (b.b === a.id && b.a === carbonId)),
      )

    for (const name of ['hex-1-ene', 'ethene', 'but-3-enamide', 'pent-1-ene']) {
      const mol = fromIupacName(name)
      const pos = layoutStructural(mol)
      for (const carbon of alkeneCarbons(mol)) {
        const cp = pos.get(carbon.id)!
        for (const h of hydrogensOn(mol, carbon.id)) {
          const hp = pos.get(h.id)!
          const below = hp.y > cp.y + 4 && Math.abs(hp.x - cp.x) < 4
          expect(below, `${name} has a C=C hydrogen below carbon ${carbon.id}`).toBe(false)
        }
      }
    }
  })

  it('puts the alkene hydrogen above the chain in the structural formula', () => {
    const mol = fromIupacName('1-bromo-3-methylbut-2-ene')
    const pos = layoutStructural(mol)
    const c2 = pos.get(mol.chain[1])!
    const h = mol.atoms.find(
      (a) =>
        a.el === 'H' &&
        mol.bonds.some((b) => (b.a === a.id && b.b === mol.chain[1]) || (b.b === a.id && b.a === mol.chain[1])),
    )!
    expect(pos.get(h.id)!.y).toBeLessThan(c2.y)
    expect(Math.abs(pos.get(h.id)!.x - c2.x)).toBeLessThan(8)
  })

  it('draws methanoic acid skeletal as a vertical C=O with OH down-right', () => {
    const mol = fromIupacName('methanoic acid')
    const pos = layoutSkeletal(mol)
    const c1 = mol.chain[0]
    const carbon = pos.get(c1)!
    const oxo = mol.atoms.find((a) => {
      if (a.el !== 'O') return false
      return mol.bonds.some(
        (b) => b.order === 2 && ((b.a === a.id && b.b === c1) || (b.b === a.id && b.a === c1)),
      )
    })!
    const hydroxyl = mol.atoms.find((a) => {
      if (a.el !== 'O') return false
      return mol.bonds.some(
        (b) => b.order === 1 && ((b.a === a.id && b.b === c1) || (b.b === a.id && b.a === c1)),
      )
    })!
    const oxoP = pos.get(oxo.id)!
    const ohP = pos.get(hydroxyl.id)!
    expect(Math.abs(oxoP.x - carbon.x)).toBeLessThan(2)
    expect(oxoP.y).toBeLessThan(carbon.y)
    expect(ohP.x).toBeGreaterThan(carbon.x + 8)
    expect(ohP.y).toBeGreaterThan(carbon.y + 8)
    const oxoA = Math.atan2(oxoP.y - carbon.y, oxoP.x - carbon.x)
    const ohA = Math.atan2(ohP.y - carbon.y, ohP.x - carbon.x)
    const hook = (Math.abs(Math.atan2(Math.sin(ohA - oxoA), Math.cos(ohA - oxoA))) * 180) / Math.PI
    expect(hook).toBeGreaterThan(100)
    expect(hook).toBeLessThan(140)
  })

  it('keeps longer-acid skeletal carboxyls on the zigzag, not the methanoic hook', () => {
    const mol = fromIupacName('ethanoic acid')
    const pos = layoutSkeletal(mol)
    const c1 = mol.chain[0]
    const carbon = pos.get(c1)!
    const oxo = mol.atoms.find((a) => {
      if (a.el !== 'O') return false
      return mol.bonds.some(
        (b) => b.order === 2 && ((b.a === a.id && b.b === c1) || (b.b === a.id && b.a === c1)),
      )
    })!
    const hydroxyl = mol.atoms.find((a) => {
      if (a.el !== 'O') return false
      return mol.bonds.some(
        (b) => b.order === 1 && ((b.a === a.id && b.b === c1) || (b.b === a.id && b.a === c1)),
      )
    })!
    expect(pos.get(oxo.id)!.y).toBeGreaterThan(carbon.y)
    expect(pos.get(hydroxyl.id)!.x).toBeLessThan(carbon.x)
  })

  it('puts carboxylic OH to the side of the carboxyl carbon', () => {
    const mol = fromIupacName('ethanoic acid')
    const pos = layoutStructural(mol)
    const carboxyl = pos.get(mol.chain[0])!
    const oxygenIds = mol.atoms.filter((a) => a.el === 'O').map((a) => a.id)
    const hydroxylO = oxygenIds.find((id) => {
      const p = pos.get(id)!
      return Math.abs(p.y - carboxyl.y) < 8
    })
    expect(hydroxylO).toBeDefined()
    expect(Math.abs(pos.get(hydroxylO!)!.x - carboxyl.x)).toBeGreaterThan(20)
  })

  it('can place locant 1 on the right of the structural formula', () => {
    const mol = fromIupacName('hex-1-ene')
    const locantX = (svg: string, n: number) => {
      const m = svg.match(new RegExp(`x="([^"]+)"[^>]*class="locant">${n}<`))
      expect(m, `missing locant ${n}`).toBeTruthy()
      return Number(m![1])
    }
    const left = renderStructuralSvg(mol, true, false)
    const right = renderStructuralSvg(mol, true, true)
    expect(locantX(left, 1)).toBeLessThan(locantX(left, 6))
    expect(locantX(right, 1)).toBeGreaterThan(locantX(right, 6))
  })

  it('mirrors the skeletal chain when fromRight is set', () => {
    const mol = fromIupacName('hex-1-ene')
    const left = layoutSkeletal(mol)
    const right = mirrorX(left)
    expect(left.get(mol.chain[0])!.x).toBeLessThan(left.get(mol.chain[5])!.x)
    expect(right.get(mol.chain[0])!.x).toBeGreaterThan(right.get(mol.chain[5])!.x)
    expect(renderSkeletalSvg(mol, true)).not.toBe(renderSkeletalSvg(mol, false))
  })
})
