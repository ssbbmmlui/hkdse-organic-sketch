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

export function halogenCount(p: ParsedCompound): number {
  let n = 0
  for (const sub of p.substituents) {
    if (HALO_KINDS.has(sub.kind)) n += sub.locants.length
  }
  return n
}

export function alkylBranchCount(p: ParsedCompound): number {
  let n = 0
  for (const sub of p.substituents) {
    if (ALKYL_CARBONS[sub.kind]) n += sub.locants.length
  }
  if (p.esterAlkoxy?.methylOnFirst) n += p.esterAlkoxy.methylOnFirst
  return n
}

/** Halogen atoms plus alkyl side chains. */
export function extraCount(p: ParsedCompound): number {
  return halogenCount(p) + alkylBranchCount(p)
}

export function hasHalogen(p: ParsedCompound): boolean {
  return halogenCount(p) > 0
}

/** Alkyl side chain on the parent (methyl, ethyl, …), not a halogen. */
export function hasAlkylBranch(p: ParsedCompound): boolean {
  return alkylBranchCount(p) > 0
}

/** Several of the same group: diene, diol/triol, diamine, dioic acid, dione. */
export function isPolyfunctional(p: ParsedCompound): boolean {
  return (
    p.doubleBonds.length >= 2 ||
    p.hydroxyls.length >= 2 ||
    p.amines.length >= 2 ||
    p.carboxyls.length >= 2 ||
    p.carbonyls.length >= 2
  )
}

/**
 * Easy: one series, and at most one extra (one halogen or one alkyl branch).
 * Medium: one series, with two or more extras (multiple halogens and/or branches).
 * Difficult: more than one series / repeated groups (diene, diol, diamine, dioic, …),
 *            including mixes with halogens and alkyl groups.
 */
export function classifyDifficulty(p: ParsedCompound): Difficulty {
  if (functionalFeatures(p).length >= 2 || isPolyfunctional(p)) return 'difficult'
  if (extraCount(p) >= 2) return 'medium'
  return 'easy'
}

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; blurb: string }
> = {
  easy: {
    label: 'Easy',
    blurb: 'One homologous series, with at most one halogen or one alkyl branch.',
  },
  medium: {
    label: 'Medium',
    blurb: 'One homologous series, with multiple halogens and/or alkyl branches.',
  },
  difficult: {
    label: 'Difficult',
    blurb:
      'More than one functional group (diene, diol/triol, diamine, dioic acid, mixed series) and/or mixing those groups with halogens and alkyl branches.',
  },
}
