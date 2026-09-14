import { describe, expect, it } from 'vitest'
import { generateFromName } from './generate'
import { NameError } from './types'

describe('generateFromName', () => {
  it('returns formulae and both SVG drawings for hex-1-ene', () => {
    const result = generateFromName('hex-1-ene', { embedStyles: true })
    expect(result.name).toBe('hex-1-ene')
    expect(result.series).toBe('alkene')
    expect(result.seriesLabel.en).toBe('Alkene')
    expect(result.formula).toBe('C6H12')
    expect(result.condensed).toBe('CH2=CHCH2CH2CH2CH3')
    expect(result.smiles).toContain('C')
    expect(result.structuralSvg).toContain('<svg')
    expect(result.skeletalSvg).toContain('<svg')
    expect(result.structuralSvg).toContain('<style>')
    expect(result.skeletalSvg).toContain('<style>')
    expect(result.graph.chain).toHaveLength(6)
    expect(result.graph.atoms.some((a) => a.el === 'C')).toBe(true)
    expect(result.graph.bonds.some((b) => b.order === 2)).toBe(true)
  })

  it('omits embedded CSS unless requested', () => {
    const result = generateFromName('ethanol')
    expect(result.structuralSvg).not.toContain('<style>')
  })

  it('rejects names outside the syllabus', () => {
    expect(() => generateFromName('cyclohexane')).toThrow(NameError)
  })
})
