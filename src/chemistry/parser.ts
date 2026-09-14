import { TRIVIAL_NAMES } from './trivial'
import {
  ALKYL_CARBONS,
  NameError,
  STEM_LENGTH,
  type AlkoxyGroup,
  type ParsedCompound,
  type Series,
  type Substituent,
  type SubstituentKind,
} from './types'

const SUB_KINDS: SubstituentKind[] = [
  'methyl',
  'ethyl',
  'propyl',
  'butyl',
  'pentyl',
  'hexyl',
  'heptyl',
  'fluoro',
  'chloro',
  'bromo',
  'iodo',
]

const MULT: Record<string, number> = { tetra: 4, tri: 3, di: 2 }
const STEM = '(meth|eth|prop|but|pent|hex|hept|oct)'
const LOCANTS = '(\\d+(?:,\\d+)*)'
const FORBIDDEN = /\b(cyclo|phenyl|benzyl|benzene|naphth|yne|thiol|nitrile|cyano|nitro|sulf|phospho|pyrid|hydroxy|oxo|amino|carboxy)\b/

const PURE_SUB = /^(tetra|tri|di)?(methyl|ethyl|propyl|butyl|pentyl|hexyl|heptyl|fluoro|chloro|bromo|iodo)$/

const LINEAR_ALKYL: Record<string, number> = {
  methyl: 1,
  ethyl: 2,
  propyl: 3,
  butyl: 4,
  pentyl: 5,
  hexyl: 6,
  heptyl: 7,
  octyl: 8,
}

export function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[‐‑–—−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
}

function parseLocants(s: string): number[] {
  return s.split(',').map((n) => Number(n))
}

function isLocants(token: string): boolean {
  return /^\d+(,\d+)*$/.test(token)
}

function looksLikeStemStart(s: string): boolean {
  return /^(meth|eth|prop|but|pent|hex|hept|oct)/.test(s)
}

function peelLeadingSubs(token: string): { kinds: SubstituentKind[]; rest: string } {
  let rest = token
  const kinds: SubstituentKind[] = []
  let changed = true
  while (changed) {
    changed = false
    for (const m of ['tetra', 'tri', 'di', ''] as const) {
      for (const kind of SUB_KINDS) {
        const prefix = m + kind
        if (rest.startsWith(prefix) && rest.length > prefix.length && looksLikeStemStart(rest.slice(prefix.length))) {
          const count = m ? MULT[m] : 1
          for (let i = 0; i < count; i += 1) kinds.push(kind)
          rest = rest.slice(prefix.length)
          changed = true
          break
        }
      }
      if (changed) break
    }
  }
  return { kinds, rest }
}

function parsePureSub(token: string): SubstituentKind[] | null {
  const m = token.match(PURE_SUB)
  if (!m) return null
  const count = m[1] ? MULT[m[1]] : 1
  const kind = m[2] as SubstituentKind
  return Array.from({ length: count }, () => kind)
}

function rejectForbidden(name: string): void {
  if (FORBIDDEN.test(name) || /\bn-/.test(name) || /\bn,n-/.test(name)) {
    throw new NameError(
      'This functional group or ring system is outside the HKDSE scope.',
      '此名稱含有課程範圍以外的結構（例如環狀、炔烴、N-取代酰胺／二級胺等）。',
    )
  }
}

interface PrefixPiece {
  locants: number[]
  kinds: SubstituentKind[]
}

function splitPrefixes(body: string): { prefixes: PrefixPiece[]; parent: string } {
  if (!body) throw new NameError('Empty name', '名稱是空的。')
  const tokens = body.split('-').filter(Boolean)
  const prefixes: PrefixPiece[] = []
  let i = 0

  const takeGlued = (token: string, locants: number[]): string | null => {
    const peeled = peelLeadingSubs(token)
    if (!peeled.kinds.length) return null
    prefixes.push({ locants, kinds: peeled.kinds })
    return peeled.rest
  }

  while (i < tokens.length) {
    if (isLocants(tokens[i]) && i + 1 < tokens.length) {
      const next = tokens[i + 1]
      const pure = parsePureSub(next)
      if (pure) {
        prefixes.push({ locants: parseLocants(tokens[i]), kinds: pure })
        i += 2
        continue
      }
      const rest = takeGlued(next, parseLocants(tokens[i]))
      if (rest) {
        tokens[i + 1] = rest
        i += 1
        break
      }
      break
    }

    const peeled = peelLeadingSubs(tokens[i])
    if (peeled.kinds.length) {
      prefixes.push({ locants: [], kinds: peeled.kinds })
      tokens[i] = peeled.rest
    }
    break
  }

  const parent = tokens.slice(i).join('-')
  if (!parent) throw new NameError('Missing parent chain', '找不到母體碳鏈。')
  return { prefixes, parent }
}

interface ParentInfo {
  stem: string
  chainLength: number
  doubleBonds: number[]
  hydroxyls: number[]
  carbonyls: number[]
  carboxyls: number[]
  amides: number[]
  amines: number[]
}

function stemOf(stem: string): { stem: string; chainLength: number } {
  const chainLength = STEM_LENGTH[stem]
  if (!chainLength) {
    throw new NameError('Unsupported chain length', '主碳鏈必須是 1 至 8 個碳（meth–oct）。')
  }
  return { stem, chainLength }
}

function parseParent(parent: string, asAcid: boolean): ParentInfo {
  let s = parent
  const empty = (): Omit<ParentInfo, 'stem' | 'chainLength'> => ({
    doubleBonds: [],
    hydroxyls: [],
    carbonyls: [],
    carboxyls: [],
    amides: [],
    amines: [],
  })

  const hit = (re: RegExp): RegExpMatchArray | null => s.match(re)

  let m = hit(new RegExp(`^${STEM}a-${LOCANTS}-(?:di|tri)ene?-${LOCANTS}-(?:di|tri|tetra)ol$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), hydroxyls: parseLocants(m[3]) }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-(?:di|tri)ene?-${LOCANTS}-ol$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), hydroxyls: parseLocants(m[3]) }
  }
  m = hit(new RegExp(`^${STEM}-${LOCANTS}-ene?-${LOCANTS}-(?:di|tri|tetra)ol$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), hydroxyls: parseLocants(m[3]) }
  }
  m = hit(new RegExp(`^${STEM}-${LOCANTS}-en-${LOCANTS}-ol$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), hydroxyls: parseLocants(m[3]) }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-(?:di|tri)ene?-${LOCANTS}-one$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), carbonyls: parseLocants(m[3]) }
  }
  m = hit(new RegExp(`^${STEM}-${LOCANTS}-en-${LOCANTS}-one$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), carbonyls: parseLocants(m[3]) }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-(?:di|tri)ene?-${LOCANTS}-(?:di|tri|tetra)amine$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), amines: parseLocants(m[3]) }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-(?:di|tri)ene?-${LOCANTS}-amine$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), amines: parseLocants(m[3]) }
  }
  m = hit(new RegExp(`^${STEM}-${LOCANTS}-ene?-${LOCANTS}-(?:di|tri|tetra)amine$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), amines: parseLocants(m[3]) }
  }
  m = hit(new RegExp(`^${STEM}-${LOCANTS}-en-${LOCANTS}-amine$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), amines: parseLocants(m[3]) }
  }
  m = hit(new RegExp(`^${STEM}-${LOCANTS}-enamide$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), amides: [1] }
  }
  m = hit(new RegExp(`^${STEM}-${LOCANTS}-enal$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), carbonyls: [1] }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-(?:di|tri)enedioic$`))
  if (m) {
    if (!asAcid) throw new NameError('Missing “acid”', '烯二酸名稱應以 acid 結尾，例如 octa-3,5-dienedioic acid。')
    const info = stemOf(m[1])
    return { ...info, ...empty(), doubleBonds: parseLocants(m[2]), carboxyls: [1, info.chainLength] }
  }
  m = hit(new RegExp(`^${STEM}-${LOCANTS}-enedioic$`))
  if (m) {
    if (!asAcid) throw new NameError('Missing “acid”', '烯二酸名稱應以 acid 結尾，例如 hex-3-enedioic acid。')
    const info = stemOf(m[1])
    return { ...info, ...empty(), doubleBonds: parseLocants(m[2]), carboxyls: [1, info.chainLength] }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-(?:di|tri)enoic$`))
  if (m) {
    if (!asAcid) throw new NameError('Missing “acid”', '烯酸名稱應以 acid 結尾，例如 octa-3,5-dienoic acid。')
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), carboxyls: [1] }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-(?:di|tri)enamide$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), amides: [1] }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-(?:di|tri)enal$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), carbonyls: [1] }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-(?:di|tri)enoate$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), carboxyls: [1] }
  }
  m = hit(new RegExp(`^${STEM}-${LOCANTS}-enoic$`))
  if (m) {
    if (!asAcid) throw new NameError('Missing “acid”', '烯酸名稱應以 acid 結尾，例如 pent-4-enoic acid。')
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]), carboxyls: [1] }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-diene$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]) }
  }
  m = hit(new RegExp(`^${STEM}a-${LOCANTS}-triene$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]) }
  }
  m = hit(new RegExp(`^${STEM}-${LOCANTS}-ene$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), doubleBonds: parseLocants(m[2]) }
  }
  m = hit(new RegExp(`^${STEM}ane-${LOCANTS}-(?:di|tri|tetra)ol$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), hydroxyls: parseLocants(m[2]) }
  }
  m = hit(new RegExp(`^${STEM}ane-${LOCANTS}-dione$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), carbonyls: parseLocants(m[2]) }
  }
  m = hit(new RegExp(`^${STEM}ane-${LOCANTS}-(?:di|tri|tetra)amine$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), amines: parseLocants(m[2]) }
  }
  m = hit(new RegExp(`^${STEM}an-${LOCANTS}-ol$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), hydroxyls: parseLocants(m[2]) }
  }
  m = hit(new RegExp(`^${STEM}an-${LOCANTS}-one$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), carbonyls: parseLocants(m[2]) }
  }
  m = hit(new RegExp(`^${STEM}an-${LOCANTS}-amine$`))
  if (m) {
    return { ...stemOf(m[1]), ...empty(), amines: parseLocants(m[2]) }
  }
  m = hit(new RegExp(`^${LOCANTS}-${STEM}enedioic$`))
  if (m) {
    if (!asAcid) throw new NameError('Missing “acid”', '烯二酸名稱應以 acid 結尾，例如 3-hexenedioic acid。')
    const info = stemOf(m[2])
    return { ...info, ...empty(), doubleBonds: parseLocants(m[1]), carboxyls: [1, info.chainLength] }
  }
  m = hit(new RegExp(`^${LOCANTS}-${STEM}ene$`))
  if (m) {
    return { ...stemOf(m[2]), ...empty(), doubleBonds: parseLocants(m[1]) }
  }
  m = hit(new RegExp(`^${LOCANTS}-${STEM}anol$`))
  if (m) {
    return { ...stemOf(m[2]), ...empty(), hydroxyls: parseLocants(m[1]) }
  }
  m = hit(new RegExp(`^${LOCANTS}-${STEM}anone$`))
  if (m) {
    return { ...stemOf(m[2]), ...empty(), carbonyls: parseLocants(m[1]) }
  }
  m = hit(new RegExp(`^${STEM}anedial$`))
  if (m) {
    const info = stemOf(m[1])
    return { ...info, ...empty(), carbonyls: [1, info.chainLength] }
  }
  m = hit(new RegExp(`^${STEM}anedione$`))
  if (m) {
    const info = stemOf(m[1])
    const carbonyls = info.chainLength === 4 ? [2, 3] : [2, info.chainLength - 1]
    return { ...info, ...empty(), carbonyls }
  }
  m = hit(new RegExp(`^${STEM}anedioic$`))
  if (m) {
    if (!asAcid) throw new NameError('Missing “acid”', '二酸名稱應以 acid 結尾，例如 hexanedioic acid。')
    const info = stemOf(m[1])
    return { ...info, ...empty(), carboxyls: [1, info.chainLength] }
  }
  m = hit(new RegExp(`^${STEM}ane$`))
  if (m) return { ...stemOf(m[1]), ...empty() }
  m = hit(new RegExp(`^${STEM}ene$`))
  if (m) return { ...stemOf(m[1]), ...empty(), doubleBonds: [1] }
  m = hit(new RegExp(`^${STEM}anol$`))
  if (m) return { ...stemOf(m[1]), ...empty(), hydroxyls: [1] }
  m = hit(new RegExp(`^${STEM}anal$`))
  if (m) return { ...stemOf(m[1]), ...empty(), carbonyls: [1] }
  m = hit(new RegExp(`^${STEM}anone$`))
  if (m) {
    const info = stemOf(m[1])
    return { ...info, ...empty(), carbonyls: [2] }
  }
  m = hit(new RegExp(`^${STEM}anoic$`))
  if (m) {
    if (!asAcid) throw new NameError('Missing “acid”', '羧酸名稱應以 acid 結尾，例如 ethanoic acid。')
    return { ...stemOf(m[1]), ...empty(), carboxyls: [1] }
  }
  m = hit(new RegExp(`^${STEM}anamide$`))
  if (m) return { ...stemOf(m[1]), ...empty(), amides: [1] }
  m = hit(new RegExp(`^${STEM}anamine$`))
  if (m) return { ...stemOf(m[1]), ...empty(), amines: [1] }
  m = hit(new RegExp(`^${STEM}anoate$`))
  if (m) return { ...stemOf(m[1]), ...empty(), carboxyls: [1] }

  throw new NameError(
    `Cannot parse parent name “${parent}”.`,
    `無法解析母體名稱「${parent}」。請使用 HKDSE 系統命名，例如 hex-1-ene、propan-2-ol。`,
  )
}

function inferLocants(piece: PrefixPiece, chainLength: number, parentHint: ParentInfo): number[] {
  if (piece.locants.length) {
    if (piece.locants.length !== piece.kinds.length) {
      throw new NameError(
        'Locant count does not match substituents',
        '取代基編號數目與取代基數目不符。',
      )
    }
    return piece.locants
  }
  if (chainLength === 1) return piece.kinds.map(() => 1)
  if (piece.kinds.length === 1 && chainLength === 2) return [1]
  if (
    piece.kinds.length === 1 &&
    piece.kinds[0] === 'methyl' &&
    chainLength >= 3 &&
    (parentHint.carboxyls.length ||
      parentHint.amides.length ||
      parentHint.hydroxyls.includes(2) ||
      parentHint.carbonyls.includes(1) ||
      parentHint.carbonyls.includes(chainLength) ||
      (!parentHint.hydroxyls.length &&
        !parentHint.carbonyls.length &&
        !parentHint.doubleBonds.length &&
        !parentHint.amines.length))
  ) {
    return [2]
  }
  throw new NameError(
    'Missing substituent locant',
    '請標明取代基位置（例如 2-methylpentane、1-chloropropane）。',
  )
}

function toSubstituents(prefixes: PrefixPiece[], parent: ParentInfo): Substituent[] {
  const grouped = new Map<string, number[]>()
  for (const piece of prefixes) {
    const locants = inferLocants(piece, parent.chainLength, parent)
    piece.kinds.forEach((kind, idx) => {
      const loc = locants[idx]
      const list = grouped.get(kind) ?? []
      list.push(loc)
      grouped.set(kind, list)
    })
  }
  return [...grouped.entries()].map(([kind, locants]) => ({
    kind: kind as SubstituentKind,
    locants,
  }))
}

function decideSeries(p: ParsedCompound): Series {
  if (p.esterAlkoxy) return 'ester'
  if (p.carboxyls.length) return 'carboxylic-acid'
  if (p.amides.length) return 'amide'
  if (p.carbonyls.length) {
    const terminal =
      p.carbonyls.every((c) => c === 1 || c === p.chainLength) &&
      (p.carboxyls.length === 0)
    const isAldehyde =
      terminal &&
      p.carbonyls.some((c) => c === 1 || c === p.chainLength) &&
      !p.carbonyls.some((c) => c !== 1 && c !== p.chainLength)
    // ketones have carbonyl on internal carbons; aldehydes on terminal
    if (p.carbonyls.some((c) => c !== 1 && c !== p.chainLength)) return 'ketone'
    if (isAldehyde) return 'aldehyde'
    return 'ketone'
  }
  if (p.hydroxyls.length) return 'alcohol'
  if (p.amines.length) return 'primary-amine'
  if (p.doubleBonds.length) return 'alkene'
  const hasHalo = p.substituents.some((s) => s.kind in { fluoro: 1, chloro: 1, bromo: 1, iodo: 1 })
  if (hasHalo) return 'haloalkane'
  return 'alkane'
}

function validateLocants(p: ParsedCompound): void {
  const n = p.chainLength
  const inRange = (xs: number[], label: string, max = n) => {
    for (const x of xs) {
      if (!Number.isInteger(x) || x < 1 || x > max) {
        throw new NameError(
          `Locant ${x} is out of range for ${label}`,
          `${label} 的編號 ${x} 超出 ${n} 碳主鏈範圍。`,
        )
      }
    }
  }
  inRange(p.doubleBonds, 'C=C', n - 1)
  inRange(p.hydroxyls, '–OH')
  inRange(p.carbonyls, 'C=O')
  inRange(p.carboxyls, '–COOH')
  inRange(p.amides, '–CONH₂')
  inRange(p.amines, '–NH₂')
  for (const sub of p.substituents) {
    inRange(sub.locants, sub.kind)
    if (ALKYL_CARBONS[sub.kind] && ALKYL_CARBONS[sub.kind] > 7) {
      throw new NameError('Alkyl too long', '烷基取代基過長，超出課程範圍。')
    }
  }
  if (p.esterAlkoxy && p.esterAlkoxy.carbons > 8) {
    throw new NameError('Alkoxy chain too long', '酯的烷氧基不可超過 8 個碳。')
  }
}

function parseAlkoxy(word: string): AlkoxyGroup {
  if (LINEAR_ALKYL[word]) return { carbons: LINEAR_ALKYL[word] }
  if (word === '1-methylethyl' || word === 'propan-2-yl' || word === 'isopropyl') {
    return { carbons: 2, methylOnFirst: 1 }
  }
  if (word === '2-methylpropyl' || word === 'isobutyl') {
    return { carbons: 3, methylOnFirst: 0 }
  }
  throw new NameError(
    `Unsupported ester alkyl “${word}”`,
    `不支援的酯烷基「${word}」。請使用 methyl、ethyl、propyl 等。`,
  )
}

function sorted(xs: number[]): number[] {
  return [...xs].sort((a, b) => a - b)
}

function compareLocants(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i += 1) {
    const av = a[i] ?? 99
    const bv = b[i] ?? 99
    if (av !== bv) return av - bv
  }
  return 0
}

/** Lowest locants for the suffix, then C=C, then prefixes. */
function numberingKey(p: ParsedCompound): number[] {
  const principal = p.carboxyls.length
    ? p.carboxyls
    : p.amides.length
      ? p.amides
      : p.hydroxyls.length
        ? p.hydroxyls
        : p.amines.length
          ? p.amines
          : p.carbonyls
  return [...sorted(principal), ...sorted(p.doubleBonds), ...sorted(p.substituents.flatMap((s) => s.locants))]
}

function reverseNumbering(p: ParsedCompound): ParsedCompound {
  const n = p.chainLength
  const atom = (loc: number) => n + 1 - loc
  const bond = (loc: number) => n - loc
  return {
    ...p,
    doubleBonds: sorted(p.doubleBonds.map(bond)),
    hydroxyls: sorted(p.hydroxyls.map(atom)),
    carbonyls: sorted(p.carbonyls.map(atom)),
    carboxyls: sorted(p.carboxyls.map(atom)),
    amides: sorted(p.amides.map(atom)),
    amines: sorted(p.amines.map(atom)),
    substituents: p.substituents.map((s) => ({ ...s, locants: sorted(s.locants.map(atom)) })),
  }
}

/** Reject names that would have lower locants if numbered from the other end. */
function rejectNonPreferredNumbering(p: ParsedCompound): void {
  if (p.esterAlkoxy || p.chainLength < 2) return
  const flipped = reverseNumbering(p)
  if (compareLocants(numberingKey(flipped), numberingKey(p)) < 0) {
    throw new NameError(
      'This numbering is incorrect. Start from the other end of the chain so the locants are as low as possible.',
      '編號不正確：應從碳鏈另一端起數，使官能基／雙鍵獲得較小編號。',
    )
  }
}

function finish(partial: Omit<ParsedCompound, 'series'>): ParsedCompound {
  const parsed: ParsedCompound = { ...partial, series: 'alkane' }
  validateLocants(parsed)
  rejectNonPreferredNumbering(parsed)
  parsed.series = decideSeries(parsed)
  return parsed
}

function parseSingleWord(body: string, asAcid: boolean, inputName: string): ParsedCompound {
  const { prefixes, parent } = splitPrefixes(body)
  const parentInfo = parseParent(parent, asAcid)
  return finish({
    inputName,
    chainLength: parentInfo.chainLength,
    substituents: toSubstituents(prefixes, parentInfo),
    doubleBonds: parentInfo.doubleBonds,
    hydroxyls: parentInfo.hydroxyls,
    carbonyls: parentInfo.carbonyls,
    carboxyls: parentInfo.carboxyls,
    amides: parentInfo.amides,
    amines: parentInfo.amines,
  })
}

export function parseIupacName(raw: string): ParsedCompound {
  const inputName = raw.trim()
  if (!inputName) {
    throw new NameError('Please enter an IUPAC name.', '請輸入化合物的 IUPAC 名稱。')
  }

  let name = normalizeName(inputName)
  if (TRIVIAL_NAMES[name]) name = TRIVIAL_NAMES[name]
  rejectForbidden(name)

  if (name.includes(' ')) {
    const words = name.split(' ')
    const last = words[words.length - 1]
    const head = words.slice(0, -1).join(' ')

    if (last === 'acid') {
      return parseSingleWord(head, true, inputName)
    }
    if (last.endsWith('oate')) {
      const alkoxy = parseAlkoxy(head)
      const acidParsed = parseSingleWord(last, false, inputName)
      return finish({
        inputName,
        chainLength: acidParsed.chainLength,
        substituents: acidParsed.substituents,
        doubleBonds: acidParsed.doubleBonds,
        hydroxyls: [],
        carbonyls: [],
        carboxyls: [1],
        amides: [],
        amines: [],
        esterAlkoxy: alkoxy,
      })
    }
    throw new NameError(
      'Unexpected multi-word name',
      '無法識別此多詞名稱。酯應為「alkyl alkanoate」，羧酸應以 acid 結尾。',
    )
  }

  return parseSingleWord(name, false, inputName)
}
