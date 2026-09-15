import { describe, expect, it } from 'vitest'
import { classifyDifficulty, functionalFeatures } from './difficulty'
import { compoundsFor, practiceCatalog } from './generate'
import { fromIupacName } from './molecule'
import { namesEquivalent } from './practice'
import { parseIupacName } from './parser'

describe('difficulty classification', () => {
  it('marks a straight-chain single series as easy', () => {
    expect(classifyDifficulty(parseIupacName('hexane'))).toBe('easy')
    expect(classifyDifficulty(parseIupacName('hex-1-ene'))).toBe('easy')
    expect(classifyDifficulty(parseIupacName('propan-2-ol'))).toBe('easy')
    expect(classifyDifficulty(parseIupacName('ethanoic acid'))).toBe('easy')
    expect(classifyDifficulty(parseIupacName('ethyl ethanoate'))).toBe('easy')
    expect(functionalFeatures(parseIupacName('hexane'))).toEqual(['alkane'])
  })

  it('marks one series with halogen or a branch as medium', () => {
    expect(classifyDifficulty(parseIupacName('2-methylpentane'))).toBe('medium')
    expect(classifyDifficulty(parseIupacName('2-bromobutane'))).toBe('medium')
    expect(classifyDifficulty(parseIupacName('2-methylpropan-2-ol'))).toBe('medium')
    expect(classifyDifficulty(parseIupacName('chloromethane'))).toBe('medium')
    expect(classifyDifficulty(parseIupacName('2-methylpentanoic acid'))).toBe('medium')
  })

  it('marks two or more series as difficult', () => {
    expect(classifyDifficulty(parseIupacName('but-3-en-1-ol'))).toBe('difficult')
    expect(classifyDifficulty(parseIupacName('pent-4-en-2-one'))).toBe('difficult')
    expect(classifyDifficulty(parseIupacName('pent-4-enoic acid'))).toBe('difficult')
    expect(classifyDifficulty(parseIupacName('3-chloroprop-1-ene'))).toBe('difficult')
    expect(classifyDifficulty(parseIupacName('4-bromo-3-methylpentan-1-ol'))).toBe('difficult')
  })
})

describe('practice catalog', () => {
  const catalog = practiceCatalog()

  it('builds a pool for every difficulty', () => {
    expect(compoundsFor('easy').length).toBeGreaterThanOrEqual(20)
    expect(compoundsFor('medium').length).toBeGreaterThanOrEqual(20)
    expect(compoundsFor('difficult').length).toBeGreaterThanOrEqual(10)
    expect(catalog.every((c) => c.difficulty === classifyDifficulty(parseIupacName(c.name)))).toBe(true)
  })

  it('only keeps names the drawer can build', () => {
    for (const item of catalog.slice(0, 40)) {
      expect(fromIupacName(item.name).formula).toMatch(/^C/)
    }
  })

  it('drops non-preferred chains and enols', () => {
    const names = new Set(catalog.map((c) => c.name))
    expect(names.has('2-ethylpropane')).toBe(false)
    expect(names.has('prop-1-en-1-ol')).toBe(false)
    expect(names.has('but-3-en-1-ol')).toBe(true)
  })
})

describe('name marking', () => {
  it('accepts equivalent IUPAC forms', () => {
    expect(namesEquivalent('hex-1-ene', 'hex-1-ene')).toBe(true)
    expect(namesEquivalent('1-hexene', 'hex-1-ene')).toBe(true)
    expect(namesEquivalent('acetone', 'propanone')).toBe(true)
    expect(namesEquivalent('acetic acid', 'ethanoic acid')).toBe(true)
    expect(namesEquivalent('hex-2-ene', 'hex-1-ene')).toBe(false)
    expect(namesEquivalent('', 'hexane')).toBe(false)
  })
})
