import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const researchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const routes = new Map([
  ['/', path.join(researchRoot, 'poc', 'index.html')],
  ['/poc/index.html', path.join(researchRoot, 'poc', 'index.html')],
  ['/poc/app.mjs', path.join(researchRoot, 'poc', 'app.mjs')],
  [
    '/vendor/fingerprintjs.js',
    path.join(researchRoot, 'node_modules', '@fingerprintjs', 'fingerprintjs', 'dist', 'fp.esm.js'),
  ],
  ['/vendor/botd.js', path.join(researchRoot, 'node_modules', '@fingerprintjs', 'botd', 'dist', 'botd.esm.js')],
])

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'text/javascript; charset=utf-8'
  return 'application/octet-stream'
}

export async function startResearchServer({ allowExternalConnect = false } = {}) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    const filePath = routes.get(pathname)
    if (!filePath) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('not found')
      return
    }

    try {
      const body = await readFile(filePath)
      const connectSource = allowExternalConnect ? 'http: https:' : "'self'"
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': contentType(filePath),
        'content-security-policy': `default-src 'none'; script-src 'self'; connect-src ${connectSource}; base-uri 'none'; frame-ancestors 'none'`,
        'x-content-type-options': 'nosniff',
      })
      response.end(body)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(`research fixture unavailable: ${error.code ?? 'unknown'}`)
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('research server did not expose a TCP address')

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  }
}
