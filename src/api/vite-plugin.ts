import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { handleFormulaApi } from './handler'
import { incomingToRequest, writeNodeResponse } from './node'

function apiMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    const path = (req.url ?? '').split('?')[0]
    if (path !== '/api' && !path.startsWith('/api/')) {
      next()
      return
    }
    void (async () => {
      try {
        const request = await incomingToRequest(req)
        const response = await handleFormulaApi(request)
        if (!response) {
          next()
          return
        }
        await writeNodeResponse(res, response)
      } catch (err) {
        next(err)
      }
    })()
  }
}

/** Expose `/api/v1` on the Vite dev and preview servers. */
export function formulaApiPlugin(): Plugin {
  return {
    name: 'organic-sketch-formula-api',
    configureServer(server) {
      server.middlewares.use(apiMiddleware())
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiMiddleware())
    },
  }
}
