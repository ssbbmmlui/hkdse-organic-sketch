import { pickCompound, type PracticeCompound } from './generate'
import { fromIupacName } from './molecule'
import { normalizeName } from './parser'
import { SERIES_META, type Series } from './types'
import type { Difficulty } from './difficulty'

export type QuestionKind = 'name' | 'series'
export type FormulaView = 'structural' | 'skeletal'

export interface PracticeQuestion {
  item: PracticeCompound
  kind: QuestionKind
  view: FormulaView
  seriesOptions: Series[]
  /** Structural formulae may run C1→Cn left-to-right or right-to-left. */
  fromRight: boolean
}

const ALL_SERIES = Object.keys(SERIES_META) as Series[]

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function seriesChoices(correct: Series): Series[] {
  const others = shuffle(ALL_SERIES.filter((s) => s !== correct)).slice(0, 3)
  return shuffle([correct, ...others])
}

export function nextQuestion(difficulty: Difficulty, previousName?: string): PracticeQuestion {
  const item = pickCompound(difficulty, previousName)
  const mol = fromIupacName(item.name)
  const kind: QuestionKind = Math.random() < 0.7 ? 'name' : 'series'
  const view: FormulaView = mol.parsed.chainLength <= 1 || Math.random() < 0.5 ? 'structural' : 'skeletal'
  return {
    item,
    kind,
    view: mol.parsed.chainLength <= 1 ? 'structural' : view,
    seriesOptions: seriesChoices(mol.parsed.series),
    fromRight: mol.parsed.chainLength > 1 && Math.random() < 0.5,
  }
}

export function namesEquivalent(student: string, expected: string): boolean {
  const typed = student.trim()
  if (!typed) return false
  if (normalizeName(typed) === normalizeName(expected)) return true
  try {
    const a = fromIupacName(typed)
    const b = fromIupacName(expected)
    return a.smiles === b.smiles && a.formula === b.formula
  } catch {
    return false
  }
}
