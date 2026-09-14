import { describe, expect, it } from 'vitest'
import { handleFormulaApi, MAX_NAME_LENGTH } from './handler'

function api(path: string, init?: RequestInit) {
  return handleFormulaApi(new Request(`http://example.test${path}`, init))
}

async function jsonOf(path: string, init?: RequestInit) {
  const response = await api(path, init)
  expect(response).not.toBeNull()
  return { response: response!, body: await response!.json() }
}

describe('formula HTTP API', () => {
  it('does not handle non-API routes', async () => {
    expect(await api('/')).toBeNull()
    expect(await api('/draw')).toBeNull()
  })

  it('returns a catalog and health check', async () => {
    const catalog = await jsonOf('/api/v1')
    expect(catalog.response.status).toBe(200)
    expect(catalog.body.version).toBe('1')
    expect(catalog.body.endpoints.formula.path).toBe('/api/v1/formula')

    const health = await jsonOf('/api/v1/health')
    expect(health.body.ok).toBe(true)
  })

  it('lists syllabus examples', async () => {
    const { body } = await jsonOf('/api/v1/examples')
    expect(body.examples.some((item: { name: string }) => item.name === 'hex-1-ene')).toBe(true)
  })

  it('GET draws a compound as JSON with CORS and both SVGs', async () => {
    const { response, body } = await jsonOf('/api/v1/formula?name=hex-1-ene')
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Content-Type')).toMatch(/application\/json/)
    expect(body.formula).toBe('C6H12')
    expect(body.condensed).toBe('CH2=CHCH2CH2CH2CH3')
    expect(body.series).toBe('alkene')
    expect(body.structuralSvg).toContain('<svg')
    expect(body.skeletalSvg).toContain('<svg')
    expect(body.structuralSvg).toContain('<style>')
    expect(body.graph.chain).toHaveLength(6)
  })

  it('POST accepts a JSON body', async () => {
    const { response, body } = await jsonOf('/api/v1/formula', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'propan-2-ol', showNumbers: true }),
    })
    expect(response.status).toBe(200)
    expect(body.formula).toBe('C3H8O')
    expect(body.series).toBe('alcohol')
    expect(body.structuralSvg).toContain('locant')
  })

  it('serves standalone SVG for other apps to embed', async () => {
    const response = await api('/api/v1/formula/skeletal.svg?name=hex-1-ene')
    expect(response).not.toBeNull()
    expect(response!.status).toBe(200)
    expect(response!.headers.get('Content-Type')).toMatch(/image\/svg\+xml/)
    const markup = await response!.text()
    expect(markup.startsWith('<svg')).toBe(true)
    expect(markup).toContain('skeletal')
    expect(markup).toContain('<style>')
  })

  it('answers CORS preflight', async () => {
    const response = await api('/api/v1/formula', { method: 'OPTIONS' })
    expect(response).not.toBeNull()
    expect(response!.status).toBe(204)
    expect(response!.headers.get('Access-Control-Allow-Methods')).toMatch(/GET/)
  })

  it('rejects missing, invalid, and oversized names', async () => {
    const missing = await jsonOf('/api/v1/formula')
    expect(missing.response.status).toBe(400)
    expect(missing.body.zh).toBeTruthy()

    const bad = await jsonOf('/api/v1/formula?name=benzene')
    expect(bad.response.status).toBe(400)
    expect(bad.body.error).toMatch(/outside the HKDSE scope/)

    const huge = await jsonOf(`/api/v1/formula?name=${'a'.repeat(MAX_NAME_LENGTH + 1)}`)
    expect(huge.response.status).toBe(400)
    expect(huge.body.error).toMatch(/too long/)
  })

  it('rejects invalid JSON bodies', async () => {
    const { response, body } = await jsonOf('/api/v1/formula', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/JSON/)
  })

  it('returns 404 for unknown API paths', async () => {
    const { response } = await jsonOf('/api/v1/missing')
    expect(response.status).toBe(404)
  })

  it('also accepts the unversioned /api/formula alias', async () => {
    const { body } = await jsonOf('/api/formula?name=ethanol')
    expect(body.formula).toBe('C2H6O')
  })
})
