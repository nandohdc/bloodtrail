import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const output = process.argv[2]
if (!output) {
  console.error('Usage: node scripts/measure-bundles.mjs <output.json>')
  process.exit(2)
}

const assets = [
  ['fingerprintjs_esm', 'node_modules/@fingerprintjs/fingerprintjs/dist/fp.esm.js'],
  ['fingerprintjs_minified_esm', 'node_modules/@fingerprintjs/fingerprintjs/dist/fp.min.js'],
  ['botd_esm', 'node_modules/@fingerprintjs/botd/dist/botd.esm.js'],
]

const measurements = []
for (const [name, file] of assets) {
  const contents = await readFile(file)
  measurements.push({
    name,
    file,
    raw_bytes: contents.byteLength,
    gzip_bytes: gzipSync(contents, { level: 9 }).byteLength,
    brotli_bytes: brotliCompressSync(contents).byteLength,
  })
}

const evidence = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  method: 'Node.js readFile plus zlib gzip level 9 and Brotli default settings',
  measurements,
}
await writeFile(path.resolve(output), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'w' })
console.log(JSON.stringify(evidence, null, 2))
