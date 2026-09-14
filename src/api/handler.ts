import { EXAMPLES, SERIES_GUIDE } from '../chemistry/examples'
import { generateFromName, type FormulaResult } from '../chemistry/generate'
import { NameError } from '../chemistry/types'

export const API_VERSION = '1'
export const MAX_NAME_LENGTH = 200

type ApiErrorBody = {
  error: string
  zh: string
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly zh: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  toBody(): ApiErrorBody {
    return { error: this.message, zh: this.zh }
  }
}

function env(name: string): string | undefined {
  return typeof process !== 'undefined' ? process.env[name] : undefined
}

function corsOrigin(): string {
  return env('CORS_ORIGIN') ?? '*'
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': corsOrigin(),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...extra,
    },
  })
}

function svg(markup: string, extra: Record<string, string> = {}): Response {
  return new Response(markup, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      ...corsHeaders(),
      ...extra,
    },
  })
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

function truthy(value: string | null): boolean {
  if (!value) return false
  return value === '1' || value === 'true' || value === 'yes'
}

function cacheControl(method: string): Record<string, string> {
  if (method === 'GET') return { 'Cache-Control': 'public, max-age=300' }
  return { 'Cache-Control': 'no-store' }
}

type FormulaRequest = {
  name: string
  showNumbers: boolean
}

function readNameFromQuery(url: URL): FormulaRequest {
  return {
    name: (url.searchParams.get('name') ?? '').trim(),
    showNumbers: truthy(url.searchParams.get('showNumbers')),
  }
}

async function readNameFromBody(request: Request): Promise<FormulaRequest> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiError(400, 'Request body must be JSON.', '請求內容必須是 JSON。')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Request body must be a JSON object.', '請求內容必須是 JSON 物件。')
  }
  const record = body as Record<string, unknown>
  const raw = record.name
  if (raw !== undefined && typeof raw !== 'string') {
    throw new ApiError(400, 'Field “name” must be a string.', '欄位 name 必須是字串。')
  }
  const showNumbers = record.showNumbers
  if (showNumbers !== undefined && typeof showNumbers !== 'boolean') {
    throw new ApiError(400, 'Field “showNumbers” must be a boolean.', '欄位 showNumbers 必須是布林值。')
  }
  return {
    name: typeof raw === 'string' ? raw.trim() : '',
    showNumbers: showNumbers === true,
  }
}

function requireName(input: FormulaRequest): string {
  if (!input.name) {
    throw new ApiError(400, 'Please provide an IUPAC name.', '請提供化合物的 IUPAC 名稱。')
  }
  if (input.name.length > MAX_NAME_LENGTH) {
    throw new ApiError(
      400,
      `Name is too long (max ${MAX_NAME_LENGTH} characters).`,
      `名稱過長（最多 ${MAX_NAME_LENGTH} 個字元）。`,
    )
  }
  return input.name
}

function draw(input: FormulaRequest): FormulaResult {
  try {
    return generateFromName(requireName(input), {
      showNumbers: input.showNumbers,
      embedStyles: true,
    })
  } catch (err) {
    if (err instanceof NameError) {
      throw new ApiError(400, err.message, err.zh)
    }
    throw err
  }
}

function formulaJson(result: FormulaResult) {
  return {
    name: result.name,
    series: result.series,
    seriesLabel: result.seriesLabel,
    formula: result.formula,
    condensed: result.condensed,
    smiles: result.smiles,
    structuralSvg: result.structuralSvg,
    skeletalSvg: result.skeletalSvg,
    graph: result.graph,
  }
}

function catalog() {
  return {
    name: 'Organic Sketch API',
    version: API_VERSION,
    description:
      'Generate HKDSE-scope structural and skeletal formulae from an IUPAC name. Parent chain ≤ 8 carbons.',
    endpoints: {
      catalog: { method: 'GET', path: '/api/v1' },
      health: { method: 'GET', path: '/api/v1/health' },
      formula: {
        method: ['GET', 'POST'],
        path: '/api/v1/formula',
        query: { name: 'IUPAC name (required)', showNumbers: 'true|false' },
        body: { name: 'string', showNumbers: 'boolean?' },
      },
      structuralSvg: { method: 'GET', path: '/api/v1/formula/structural.svg', query: { name: 'required', showNumbers: 'optional' } },
      skeletalSvg: { method: 'GET', path: '/api/v1/formula/skeletal.svg', query: { name: 'required' } },
      examples: { method: 'GET', path: '/api/v1/examples' },
    },
    scope: SERIES_GUIDE,
  }
}

/**
 * Handle `/api/*` requests. Returns `null` so Vite can pass non-API traffic through.
 */
export async function handleFormulaApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url)
  const path = normalizePath(url.pathname)
  if (!isApiPath(path)) return null

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  try {
    if (path === '/api' || path === '/api/v1') {
      if (request.method !== 'GET') {
        throw new ApiError(405, 'Method not allowed.', '不支援此 HTTP 方法。')
      }
      return json(catalog())
    }

    if (path === '/api/health' || path === '/api/v1/health') {
      if (request.method !== 'GET') {
        throw new ApiError(405, 'Method not allowed.', '不支援此 HTTP 方法。')
      }
      return json({ ok: true, version: API_VERSION })
    }

    if (path === '/api/v1/examples' || path === '/api/examples') {
      if (request.method !== 'GET') {
        throw new ApiError(405, 'Method not allowed.', '不支援此 HTTP 方法。')
      }
      return json({ examples: EXAMPLES })
    }

    if (path === '/api/v1/formula' || path === '/api/formula') {
      if (request.method === 'GET') {
        const result = draw(readNameFromQuery(url))
        return json(formulaJson(result), 200, cacheControl('GET'))
      }
      if (request.method === 'POST') {
        const result = draw(await readNameFromBody(request))
        return json(formulaJson(result), 200, cacheControl('POST'))
      }
      throw new ApiError(405, 'Method not allowed. Use GET or POST.', '請使用 GET 或 POST。')
    }

    if (path === '/api/v1/formula/structural.svg' || path === '/api/formula/structural.svg') {
      if (request.method !== 'GET') {
        throw new ApiError(405, 'Method not allowed.', '不支援此 HTTP 方法。')
      }
      const result = draw(readNameFromQuery(url))
      return svg(result.structuralSvg, cacheControl('GET'))
    }

    if (path === '/api/v1/formula/skeletal.svg' || path === '/api/formula/skeletal.svg') {
      if (request.method !== 'GET') {
        throw new ApiError(405, 'Method not allowed.', '不支援此 HTTP 方法。')
      }
      const result = draw(readNameFromQuery(url))
      return svg(result.skeletalSvg, cacheControl('GET'))
    }

    return json({ error: 'Not found.', zh: '找不到此 API 路徑。' } satisfies ApiErrorBody, 404)
  } catch (err) {
    if (err instanceof ApiError) {
      return json(err.toBody(), err.status)
    }
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message, zh: '伺服器發生未預期的錯誤。' } satisfies ApiErrorBody, 500)
  }
}
