import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { assertSafeEvidence } from '../lib/evidence.mjs'

const paths = process.argv.slice(2)
if (paths.length === 0) {
  console.error('Usage: node scripts/validate-evidence.mjs <evidence.json> [...]')
  process.exit(2)
}

for (const path of paths) {
  const value = JSON.parse(await readFile(resolve(path), 'utf8'))
  assertSafeEvidence(value)
  console.log(`Safe evidence: ${resolve(path)}`)
}
