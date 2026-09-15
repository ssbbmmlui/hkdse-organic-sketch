import { ALKYL_CARBONS, HALO_ELEMENT, type ParsedCompound } from './types'

export type Difficulty = 'easy' | 'medium' | 'difficult'

export type Feature =
  | 'alkane'
  | 'alkene'
  | 'halo'
  | 'alcohol'
  | 'aldehyde'
  | 'ketone'
  | 'carboxylic-acid'
  | 'ester'
  | 'amide'
  | 'primary-amine'

const HALO_KINDS = new Set(Object.keys(HALO_ELEMENT))

/** Distinct homologous series / functional-group types on the molecule. */
export function functionalFeatures(p: ParsedCompound): Feature[] {
  const out: Feature[] = []
  if (p.esterAlkoxy) out.push('ester')
  else if (p.carboxyls.length) out.push('carboxylic-acid')
  if (p.amides.length) out.push('amide')
  if (p.carbonyls.length && !p.carboxyls.length && !p.amides.length && !p.esterAlkoxy) {
    if (p.carbonyls.some((c) => c !== 1 && c !== p.chainLength)) out.push('ketone')
    else out.push('aldehyde')
  }
  if (p.hydroxyls.length) out.push('alcohol')
  if (p.amines.length) out.push('primary-amine')
  if (p.doubleBonds.length) out.push('alkene')
  if (p.substituents.some((s) => HALO_KINDS.has(s.kind))) out.push('halo')
  if (!out.length) out.push('alkane')
  return out
}

export function hasHalogen(p: ParsedCompound): boolean {
  return p.substituents.some((s) => HALO_KINDS.has(s.kind))
}

/** Alkyl side chain on the parent (methyl, ethyl, …), not a halogen. */
export function hasAlkylBranch(p: ParsedCompound): boolean {
  if (p.substituents.some((s) => Boolean(ALKYL_CARBONS[s.kind]))) return true
  return Boolean(p.esterAlkoxy?.methylOnFirst)
}

/**
 * Easy: one series, no halogen, no alkyl branch.
 * Medium: one series, and it has a halogen and/or an alkyl branch.
 * Difficult: two or more series / functional groups (halogens and branches allowed).
 */
export function classifyDifficulty(p: ParsedCompound): Difficulty {
  const n = functionalFeatures(p).length
  if (n >= 2) return 'difficult'
  if (n === 1 && (hasHalogen(p) || hasAlkylBranch(p))) return 'medium'
  return 'easy'
}

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; blurb: string }
> = {
  easy: {
    label: 'Easy',
    blurb: 'One homologous series, no halogen and no alkyl branch.',
  },
  medium: {
    label: 'Medium',
    blurb: 'One homologous series, with a halogen and/or an alkyl branch.',
  },
  difficult: {
    label: 'Difficult',
    blurb: 'Two or more series / functional groups; may also have halogens and branches.',
  },
}
