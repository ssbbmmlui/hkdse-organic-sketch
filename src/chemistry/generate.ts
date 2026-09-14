import { fromIupacName } from './molecule'
import { renderBoth } from './render'
import { embedSvgStyles } from './styles'
import { SERIES_META, type Molecule, type Series } from './types'

export type GenerateOptions = {
  showNumbers?: boolean
  embedStyles?: boolean
}

export type FormulaGraph = {
  atoms: Molecule['atoms']
  bonds: Molecule['bonds']
  chain: Molecule['chain']
}

export type FormulaResult = {
  name: string
  series: Series
  seriesLabel: { en: string; zh: string; general: string }
  formula: string
  condensed: string
  smiles: string
  structuralSvg: string
  skeletalSvg: string
  graph: FormulaGraph
}

export function generateFromName(name: string, options: GenerateOptions = {}): FormulaResult {
  const mol = fromIupacName(name)
  const { structural, skeletal } = renderBoth(mol, options.showNumbers ?? false)
  const structuralSvg = options.embedStyles ? embedSvgStyles(structural) : structural
  const skeletalSvg = options.embedStyles ? embedSvgStyles(skeletal) : skeletal
  return {
    name: mol.parsed.inputName,
    series: mol.parsed.series,
    seriesLabel: SERIES_META[mol.parsed.series],
    formula: mol.formula,
    condensed: mol.condensed,
    smiles: mol.smiles,
    structuralSvg,
    skeletalSvg,
    graph: {
      atoms: mol.atoms,
      bonds: mol.bonds,
      chain: mol.chain,
    },
  }
}
