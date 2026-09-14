export type Element = 'C' | 'H' | 'O' | 'N' | 'F' | 'Cl' | 'Br' | 'I'

export type Series =
  | 'alkane'
  | 'alkene'
  | 'haloalkane'
  | 'alcohol'
  | 'aldehyde'
  | 'ketone'
  | 'carboxylic-acid'
  | 'ester'
  | 'amide'
  | 'primary-amine'

export type SubstituentKind =
  | 'methyl'
  | 'ethyl'
  | 'propyl'
  | 'butyl'
  | 'pentyl'
  | 'hexyl'
  | 'heptyl'
  | 'fluoro'
  | 'chloro'
  | 'bromo'
  | 'iodo'

export interface Substituent {
  locants: number[]
  kind: SubstituentKind
}

export interface AlkoxyGroup {
  carbons: number
  /** Extra methyls on the alkoxy carbon attached to oxygen, e.g. 1-methylethyl. */
  methylOnFirst?: number
}

export interface ParsedCompound {
  inputName: string
  chainLength: number
  substituents: Substituent[]
  doubleBonds: number[]
  hydroxyls: number[]
  carbonyls: number[]
  carboxyls: number[]
  amides: number[]
  amines: number[]
  esterAlkoxy?: AlkoxyGroup
  series: Series
}

export interface Atom {
  id: number
  el: Element
}

export interface Bond {
  a: number
  b: number
  order: 1 | 2 | 3
}

export interface Molecule {
  atoms: Atom[]
  bonds: Bond[]
  chain: number[]
  parsed: ParsedCompound
  formula: string
  condensed: string
  smiles: string
}

export class NameError extends Error {
  constructor(
    message: string,
    readonly zh: string,
  ) {
    super(message)
    this.name = 'NameError'
  }
}

export const STEM_LENGTH: Record<string, number> = {
  meth: 1,
  eth: 2,
  prop: 3,
  but: 4,
  pent: 5,
  hex: 6,
  hept: 7,
  oct: 8,
}

export const ALKYL_CARBONS: Record<string, number> = {
  methyl: 1,
  ethyl: 2,
  propyl: 3,
  butyl: 4,
  pentyl: 5,
  hexyl: 6,
  heptyl: 7,
}

export const HALO_ELEMENT: Record<string, Element> = {
  fluoro: 'F',
  chloro: 'Cl',
  bromo: 'Br',
  iodo: 'I',
}

export const SERIES_META: Record<
  Series,
  { en: string; zh: string; general: string }
> = {
  alkane: { en: 'Alkane', zh: '烷', general: 'CₙH₂ₙ₊₂' },
  alkene: { en: 'Alkene', zh: '烯', general: 'CₙH₂ₙ' },
  haloalkane: { en: 'Haloalkane', zh: '鹵烷', general: 'CₙH₂ₙ₊₁X' },
  alcohol: { en: 'Alcohol', zh: '醇', general: 'CₙH₂ₙ₊₁OH' },
  aldehyde: { en: 'Aldehyde', zh: '醛', general: 'CₙH₂ₙO' },
  ketone: { en: 'Ketone', zh: '酮', general: 'CₙH₂ₙO' },
  'carboxylic-acid': { en: 'Carboxylic acid', zh: '羧酸', general: 'CₙH₂ₙO₂' },
  ester: { en: 'Ester', zh: '酯', general: 'CₙH₂ₙO₂' },
  amide: { en: 'Unsubstituted amide', zh: '未經取代的酰胺', general: 'CₙH₂ₙ₊₁NO' },
  'primary-amine': { en: 'Primary amine', zh: '一級胺', general: 'CₙH₂ₙ₊₃N' },
}

export const VALENCE: Record<Element, number> = {
  C: 4,
  H: 1,
  O: 2,
  N: 3,
  F: 1,
  Cl: 1,
  Br: 1,
  I: 1,
}
