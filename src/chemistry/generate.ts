import { classifyDifficulty, functionalFeatures, hasAlkylBranch, hasHalogen, type Difficulty } from './difficulty'
import { fromIupacName } from './molecule'
import { ALKYL_CARBONS, type Molecule, type ParsedCompound } from './types'

function doubleBondCarbons(p: ParsedCompound): Set<number> {
  const atoms = new Set<number>()
  for (const loc of p.doubleBonds) {
    atoms.add(loc)
    atoms.add(loc + 1)
  }
  return atoms
}

/** Ethyl on a short parent is actually a longer chain (2-ethylpropane → 2-methylbutane). */
function violatesLongestChain(p: ParsedCompound): boolean {
  const n = p.chainLength
  for (const sub of p.substituents) {
    const alkyl = ALKYL_CARBONS[sub.kind]
    if (!alkyl) continue
    for (const loc of sub.locants) {
      if (alkyl + Math.max(loc - 1, n - loc) + 1 > n) return true
    }
  }
  return false
}

function isEnolOrEnamine(p: ParsedCompound): boolean {
  const db = doubleBondCarbons(p)
  return p.hydroxyls.some((loc) => db.has(loc)) || p.amines.some((loc) => db.has(loc))
}

function carbonylOnDoubleBond(p: ParsedCompound): boolean {
  const db = doubleBondCarbons(p)
  return (
    p.carbonyls.some((loc) => db.has(loc)) ||
    p.carboxyls.some((loc) => db.has(loc)) ||
    p.amides.some((loc) => db.has(loc))
  )
}

function usableForPractice(p: ParsedCompound): boolean {
  return !violatesLongestChain(p) && !isEnolOrEnamine(p) && !carbonylOnDoubleBond(p)
}

const STEMS = ['meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct'] as const
const HALOS = ['fluoro', 'chloro', 'bromo', 'iodo'] as const
const ALKYLS = ['methyl', 'ethyl'] as const

function stem(n: number): string {
  return STEMS[n - 1]
}

export interface PracticeCompound {
  name: string
  difficulty: Difficulty
  features: ReturnType<typeof functionalFeatures>
  hasHalo: boolean
  hasBranch: boolean
}

function moleculeKey(mol: Molecule): string {
  return `${mol.smiles}|${mol.formula}`
}

function collect(names: Iterable<string>): PracticeCompound[] {
  const byKey = new Map<string, PracticeCompound>()
  for (const name of names) {
    try {
      const mol = fromIupacName(name)
      if (!usableForPractice(mol.parsed)) continue
      const key = moleculeKey(mol)
      if (byKey.has(key)) continue
      const { parsed } = mol
      byKey.set(key, {
        name,
        difficulty: classifyDifficulty(parsed),
        features: functionalFeatures(parsed),
        hasHalo: hasHalogen(parsed),
        hasBranch: hasAlkylBranch(parsed),
      })
    } catch {
      /* skip names the parser or valence check rejects */
    }
  }
  return [...byKey.values()]
}

function* candidateNames(): Generator<string> {
  for (let n = 1; n <= 8; n += 1) yield `${stem(n)}ane`

  for (let n = 2; n <= 8; n += 1) {
    yield `${stem(n)}ene`
    for (let loc = 1; loc <= n - 1; loc += 1) {
      yield `${stem(n)}-${loc}-ene`
    }
  }

  yield 'methanol'
  yield 'ethanol'
  for (let n = 3; n <= 8; n += 1) {
    for (let loc = 1; loc <= n; loc += 1) yield `${stem(n)}an-${loc}-ol`
  }

  for (let n = 1; n <= 8; n += 1) yield `${stem(n)}anal`

  yield 'propanone'
  yield 'butanone'
  for (let n = 3; n <= 8; n += 1) {
    for (let loc = 2; loc <= n - 1; loc += 1) yield `${stem(n)}an-${loc}-one`
  }

  for (let n = 1; n <= 8; n += 1) yield `${stem(n)}anoic acid`
  for (let n = 1; n <= 8; n += 1) yield `${stem(n)}anamide`

  yield 'methanamine'
  yield 'ethanamine'
  for (let n = 3; n <= 8; n += 1) {
    for (let loc = 1; loc <= n; loc += 1) yield `${stem(n)}an-${loc}-amine`
  }

  for (const alkoxy of ['methyl', 'ethyl', 'propyl', 'butyl'] as const) {
    for (let n = 1; n <= 5; n += 1) yield `${alkoxy} ${stem(n)}anoate`
  }

  for (let n = 3; n <= 8; n += 1) {
    for (const alkyl of ALKYLS) {
      for (let loc = 2; loc <= n - 1; loc += 1) {
        yield `${loc}-${alkyl}${stem(n)}ane`
      }
    }
  }
  yield '2-methylpropane'
  yield '2-methylbutane'
  yield '2,2-dimethylpropane'
  yield '2,3-dimethylbutane'
  yield '2-methylpropan-2-ol'
  yield '2-methylpropan-1-ol'
  yield '2-methylpropanoic acid'
  yield '2-methylpropanamide'
  yield '3-methylbutan-2-one'
  yield '3-methylpentan-2-one'

  for (let n = 4; n <= 8; n += 1) {
    for (let mLoc = 2; mLoc <= n - 1; mLoc += 1) {
      for (let oh = 1; oh <= n; oh += 1) {
        yield `${mLoc}-methyl${stem(n)}an-${oh}-ol`
      }
      for (let one = 2; one <= n - 1; one += 1) {
        yield `${mLoc}-methyl${stem(n)}an-${one}-one`
      }
      yield `${mLoc}-methyl${stem(n)}anoic acid`
      yield `${mLoc}-methyl${stem(n)}anamide`
      for (let am = 1; am <= n; am += 1) {
        yield `${mLoc}-methyl${stem(n)}an-${am}-amine`
      }
    }
  }

  for (const halo of HALOS) {
    yield `${halo}methane`
    yield `${halo}ethane`
    for (let n = 3; n <= 8; n += 1) {
      for (let loc = 1; loc <= n; loc += 1) {
        yield `${loc}-${halo}${stem(n)}ane`
      }
    }
    yield `1,2-di${halo}ethane`
    yield `1,1,1-tri${halo}methane`
  }
  yield 'trichloromethane'
  yield 'chloroform'

  for (const halo of ['chloro', 'bromo'] as const) {
    for (let n = 4; n <= 7; n += 1) {
      for (let hLoc = 1; hLoc <= n; hLoc += 1) {
        for (let mLoc = 2; mLoc <= n - 1; mLoc += 1) {
          yield `${hLoc}-${halo}-${mLoc}-methyl${stem(n)}ane`
          yield `${mLoc}-methyl-${hLoc}-${halo}${stem(n)}ane`
        }
      }
    }
  }

  for (let n = 3; n <= 8; n += 1) {
    for (let e = 1; e <= n - 1; e += 1) {
      for (let oh = 1; oh <= n; oh += 1) yield `${stem(n)}-${e}-en-${oh}-ol`
      for (let one = 2; one <= n - 1; one += 1) yield `${stem(n)}-${e}-en-${one}-one`
      yield `${stem(n)}-${e}-enal`
      yield `${stem(n)}-${e}-enoic acid`
      yield `${stem(n)}-${e}-enamide`
      for (let am = 1; am <= n; am += 1) yield `${stem(n)}-${e}-en-${am}-amine`
    }
  }

  for (const halo of ['chloro', 'bromo', 'fluoro', 'iodo'] as const) {
    for (let n = 3; n <= 7; n += 1) {
      for (let e = 1; e <= n - 1; e += 1) {
        for (let hLoc = 1; hLoc <= n; hLoc += 1) {
          yield `${hLoc}-${halo}${stem(n)}-${e}-ene`
        }
      }
    }
  }

  for (const halo of ['chloro', 'bromo'] as const) {
    for (let n = 4; n <= 7; n += 1) {
      for (let e = 1; e <= n - 1; e += 1) {
        for (let oh = 1; oh <= n; oh += 1) {
          yield `${stem(n)}-${e}-en-${oh}-ol`
          for (let hLoc = 1; hLoc <= n; hLoc += 1) {
            yield `${hLoc}-${halo}${stem(n)}-${e}-en-${oh}-ol`
          }
        }
      }
    }
  }

  yield 'but-3-en-1-ol'
  yield 'pent-4-en-2-one'
  yield 'pent-4-enoic acid'
  yield 'hex-3-enedioic acid'
  yield 'pent-3-enamide'
  yield 'but-3-en-1-amine'
  yield '4-bromo-3-methylpentan-1-ol'
  yield '3-chloroprop-1-ene'
  yield '4-bromobut-1-ene'

  for (let n = 4; n <= 8; n += 1) {
    for (let a = 1; a <= n - 2; a += 1) {
      for (let b = a + 1; b <= n - 1; b += 1) {
        yield `${stem(n)}a-${a},${b}-diene`
      }
    }
  }
  yield 'penta-1,3-diene'
  yield 'penta-1,4-diene'
  yield 'hexa-1,3-diene'
  yield 'hexa-1,4-diene'
  yield 'hexa-2,4-diene'

  for (let n = 2; n <= 8; n += 1) {
    for (let a = 1; a <= n - 1; a += 1) {
      for (let b = a + 1; b <= n; b += 1) {
        yield `${stem(n)}ane-${a},${b}-diol`
        yield `${stem(n)}ane-${a},${b}-diamine`
      }
    }
  }
  yield 'propane-1,2-diol'
  yield 'propane-1,2,3-triol'
  yield 'butane-1,2,3-triol'
  yield 'pentane-1,2,3-triol'
  yield 'propane-1,2,3-triamine'
  yield 'butane-1,2-diamine'
  yield 'pentane-1,5-diamine'

  for (let n = 2; n <= 8; n += 1) yield `${stem(n)}anedioic acid`
  yield 'ethanedioic acid'
  yield 'butanedioic acid'
  yield 'hexanedioic acid'
  yield 'hex-3-enedioic acid'
  yield 'octa-3,5-dienedioic acid'

  for (let n = 4; n <= 8; n += 1) {
    for (let a = 2; a <= n - 2; a += 1) {
      for (let b = a + 1; b <= n - 1; b += 1) {
        yield `${stem(n)}ane-${a},${b}-dione`
      }
    }
  }
  yield 'pentane-2,4-dione'

  for (let n = 5; n <= 8; n += 1) {
    for (let mLoc = 2; mLoc <= n - 1; mLoc += 1) {
      yield `${mLoc}-methyl${stem(n)}ane-1,2-diol`
      yield `${mLoc}-methyl${stem(n)}anedioic acid`
      yield `${mLoc}-methylhexa-1,3-diene`
    }
  }
  for (const halo of ['chloro', 'bromo'] as const) {
    for (let n = 4; n <= 7; n += 1) {
      yield `1-${halo}${stem(n)}ane-1,2-diol`
      yield `${n}-${halo}${stem(n)}anedioic acid`
      yield `4-${halo}hexa-1,3-diene`
      yield `3-${halo}-2-methyl${stem(n)}ane`
    }
  }
}

let catalog: PracticeCompound[] | null = null

export function practiceCatalog(): PracticeCompound[] {
  if (!catalog) catalog = collect(candidateNames())
  return catalog
}

export function compoundsFor(difficulty: Difficulty): PracticeCompound[] {
  return practiceCatalog().filter((c) => c.difficulty === difficulty)
}

export function pickCompound(difficulty: Difficulty, avoidName?: string): PracticeCompound {
  const pool = compoundsFor(difficulty)
  if (!pool.length) {
    throw new Error(`No practice compounds for ${difficulty}`)
  }
  const choices = avoidName ? pool.filter((c) => c.name !== avoidName) : pool
  const bag = choices.length ? choices : pool
  return bag[Math.floor(Math.random() * bag.length)]
}
