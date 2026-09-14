import { createServer } from 'node:http'
import { handleFormulaApi } from './handler'
import { incomingToRequest, writeNodeResponse } from './node'

const port = Number(process.env.PORT) || 8787
const host = process.env.HOST || '127.0.0.1'

const server = createServer((req, res) => {
  void (async () => {
    try {
      const request = await incomingToRequest(req)
      const response =
        (await handleFormulaApi(request)) ??
        new Response(JSON.stringify({ error: 'Not found.', zh: '找不到此路徑。' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        })
      await writeNodeResponse(res, response)
    } catch {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Internal server error.', zh: '伺服器發生未預期的錯誤。' }))
    }
  })()
})

server.listen(port, host, () => {
  console.log(`Organic Sketch API  http://${host}:${port}/api/v1`)
  console.log(`Example             http://${host}:${port}/api/v1/formula?name=hex-1-ene`)
})
