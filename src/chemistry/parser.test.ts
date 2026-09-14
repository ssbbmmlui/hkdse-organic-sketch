import { describe, expect, it } from 'vitest'
import { fromIupacName } from './molecule'
import { parseIupacName } from './parser'
import { NameError } from './types'

function formula(name: string) {
  return fromIupacName(name).formula
}

function series(name: string) {
  return parseIupacName(name).series
}

describe('HKDSE IUPAC parser', () => {
  it('parses hex-1-ene as the user example', () => {
    const mol = fromIupacName('hex-1-ene')
    expect(mol.formula).toBe('C6H12')
    expect(mol.parsed.series).toBe('alkene')
    expect(mol.parsed.doubleBonds).toEqual([1])
    expect(mol.parsed.chainLength).toBe(6)
    expect(mol.condensed).toBe('CH2=CHCH2CH2CH2CH3')
  })

  it('accepts old-style 1-hexene', () => {
    expect(formula('1-hexene')).toBe('C6H12')
    expect(parseIupacName('1-hexene').doubleBonds).toEqual([1])
  })

  it('parses alkanes including branches', () => {
    expect(formula('methane')).toBe('CH4')
    expect(formula('butane')).toBe('C4H10')
    expect(formula('octane')).toBe('C8H18')
    expect(formula('2-methylpentane')).toBe('C6H14')
    expect(formula('methylpropane')).toBe('C4H10')
    expect(formula('3-ethyl-2,4-dimethylhexane')).toBe('C10H22')
    expect(series('2-methylpentane')).toBe('alkane')
  })

  it('parses alkenes from the textbook', () => {
    expect(formula('ethene')).toBe('C2H4')
    expect(formula('propene')).toBe('C3H6')
    expect(formula('4-methylhex-2-ene')).toBe('C7H14')
    expect(formula('4-methylpenta-1,3-diene')).toBe('C6H10')
  })

  it('parses haloalkanes', () => {
    expect(formula('chloromethane')).toBe('CH3Cl')
    expect(formula('bromoethane')).toBe('C2H5Br')
    expect(formula('1-fluoropropane')).toBe('C3H7F')
    expect(formula('2-bromo-1-chloropropane')).toBe('C3H6BrCl')
    expect(formula('1,2,4-trichlorobutane')).toBe('C4H7Cl3')
    expect(formula('chloroform')).toBe('CHCl3')
    expect(series('2-bromobutane')).toBe('haloalkane')
  })

  it('parses alcohols', () => {
    expect(formula('methanol')).toBe('CH4O')
    expect(formula('ethanol')).toBe('C2H6O')
    expect(formula('propan-1-ol')).toBe('C3H8O')
    expect(formula('propan-2-ol')).toBe('C3H8O')
    expect(formula('isopropyl alcohol')).toBe('C3H8O')
    expect(formula('2-methylpropan-2-ol')).toBe('C4H10O')
    expect(formula('methylpropan-2-ol')).toBe('C4H10O')
    expect(formula('propane-1,2-diol')).toBe('C3H8O2')
    expect(formula('but-3-en-1-ol')).toBe('C4H8O')
    expect(formula('penta-1,4-dien-3-ol')).toBe('C5H8O')
    expect(formula('penta-1,4-diene-3-ol')).toBe('C5H8O')
    expect(formula('penta-1,4-diene-2,3-diol')).toBe('C5H8O2')
    expect(parseIupacName('penta-1,4-diene-2,3-diol').hydroxyls).toEqual([2, 3])
    expect(parseIupacName('penta-1,4-diene-2,3-diol').doubleBonds).toEqual([1, 4])
    expect(formula('pent-4-ene-1,2-diol')).toBe('C5H10O2')
    expect(formula('pent-4-en-1,2-diol')).toBe('C5H10O2')
    expect(formula('propane-1,2,3-triol')).toBe('C3H8O3')
    expect(formula('pent-4-ene-1,2,3-triol')).toBe('C5H10O3')
    expect(formula('pent-4-en-1,2,3-triol')).toBe('C5H10O3')
    expect(formula('4-bromo-3-methylpentan-1-ol')).toBe('C6H13BrO')
    expect(series('propan-2-ol')).toBe('alcohol')
  })

  it('parses aldehydes and ketones', () => {
    expect(formula('methanal')).toBe('CH2O')
    expect(formula('formaldehyde')).toBe('CH2O')
    expect(formula('ethanal')).toBe('C2H4O')
    expect(formula('propanone')).toBe('C3H6O')
    expect(formula('acetone')).toBe('C3H6O')
    expect(formula('butanone')).toBe('C4H8O')
    expect(formula('pentan-2-one')).toBe('C5H10O')
    expect(formula('pentan-3-one')).toBe('C5H10O')
    expect(formula('pentane-2,4-dione')).toBe('C5H8O2')
    expect(formula('3-methylbut-2-enal')).toBe('C5H8O')
    expect(formula('pent-4-en-2-one')).toBe('C5H8O')
    expect(series('ethanal')).toBe('aldehyde')
    expect(series('pentan-2-one')).toBe('ketone')
  })

  it('parses carboxylic acids, esters, amides and amines', () => {
    expect(formula('methanoic acid')).toBe('CH2O2')
    expect(formula('ethanoic acid')).toBe('C2H4O2')
    expect(formula('acetic acid')).toBe('C2H4O2')
    expect(formula('methylpropanoic acid')).toBe('C4H8O2')
    expect(formula('2-methylpentanoic acid')).toBe('C6H12O2')
    expect(formula('hexanedioic acid')).toBe('C6H10O4')
    expect(formula('hex-3-enedioic acid')).toBe('C6H8O4')
    expect(parseIupacName('hex-3-enedioic acid').doubleBonds).toEqual([3])
    expect(parseIupacName('hex-3-enedioic acid').carboxyls).toEqual([1, 6])
    expect(formula('octa-3,5-dienedioic acid')).toBe('C8H10O4')
    expect(parseIupacName('octa-3,5-dienedioic acid').doubleBonds).toEqual([3, 5])
    expect(parseIupacName('octa-3,5-dienedioic acid').carboxyls).toEqual([1, 8])
    expect(formula('pent-4-enoic acid')).toBe('C5H8O2')
    expect(formula('octa-3,5-dienoic acid')).toBe('C8H12O2')
    expect(parseIupacName('octa-3,5-dienoic acid').doubleBonds).toEqual([3, 5])
    expect(parseIupacName('octa-3,5-dienoic acid').carboxyls).toEqual([1])
    expect(formula('ethyl ethanoate')).toBe('C4H8O2')
    expect(formula('methyl butanoate')).toBe('C5H10O2')
    expect(formula('propyl 2-methylpentanoate')).toBe('C9H18O2')
    expect(formula('ethanamide')).toBe('C2H5NO')
    expect(formula('methanamide')).toBe('CH3NO')
    expect(formula('methylpropanamide')).toBe('C4H9NO')
    expect(formula('pent-3-enamide')).toBe('C5H9NO')
    expect(formula('methanamine')).toBe('CH5N')
    expect(formula('ethanamine')).toBe('C2H7N')
    expect(formula('propan-1-amine')).toBe('C3H9N')
    expect(formula('pentan-2-amine')).toBe('C5H13N')
    expect(formula('but-3-en-1-amine')).toBe('C4H9N')
    expect(formula('butane-1,2-diamine')).toBe('C4H12N2')
    expect(formula('propane-1,2,3-triamine')).toBe('C3H11N3')
    expect(formula('pentane-1,3,5-triamine')).toBe('C5H15N3')
    expect(formula('pent-2-ene-1,5-diamine')).toBe('C5H12N2')
    expect(series('ethyl ethanoate')).toBe('ester')
    expect(series('ethanamide')).toBe('amide')
    expect(series('propan-1-amine')).toBe('primary-amine')
  })

  it('rejects out-of-syllabus or invalid names', () => {
    expect(() => fromIupacName('nonane')).toThrow(NameError)
    expect(() => fromIupacName('cyclohexane')).toThrow(NameError)
    expect(() => fromIupacName('hex-1-yne')).toThrow(NameError)
    expect(() => fromIupacName('benzene')).toThrow(NameError)
    expect(() => fromIupacName('N-methylethanamide')).toThrow(NameError)
    expect(() => fromIupacName('hex-9-ene')).toThrow(NameError)
    expect(() => fromIupacName('penta-1,4-diene-3,4-diol')).toThrow(NameError)
    expect(() => fromIupacName('hex-4-enedioic acid')).toThrow(NameError)
  })
})
