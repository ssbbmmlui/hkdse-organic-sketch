import type { IncomingMessage, ServerResponse } from 'node:http'

function hasRequestBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export async function incomingToRequest(req: IncomingMessage): Promise<Request> {
  const host = typeof req.headers.host === 'string' && req.headers.host ? req.headers.host : 'localhost'
  const url = new URL(req.url ?? '/', `http://${host}`)
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  const method = req.method ?? 'GET'
  if (!hasRequestBody(method)) {
    return new Request(url, { method, headers })
  }
  const body = await readBody(req)
  return new Request(url, { method, headers, body: body.length ? new Uint8Array(body) : undefined })
}

export async function writeNodeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  if (response.statusText) res.statusMessage = response.statusText
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  if (!response.body || response.status === 204) {
    res.end()
    return
  }
  res.end(Buffer.from(await response.arrayBuffer()))
}
