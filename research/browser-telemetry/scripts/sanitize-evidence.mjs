import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { sanitizeLegacyEvidence, writeNewJson } from '../lib/evidence.mjs'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const inputPath = option('--input')
const metadataPath = option('--metadata')
const outputPath = option('--output')
if (!inputPath || !metadataPath || !outputPath) {
  console.error('Usage: node scripts/sanitize-evidence.mjs --input <raw.json> --metadata <metadata.json> --output <new.json>')
  process.exit(2)
}

const [raw, metadata] = await Promise.all([
  readFile(path.resolve(inputPath), 'utf8').then(JSON.parse),
  readFile(path.resolve(metadataPath), 'utf8').then(JSON.parse),
])
const evidence = sanitizeLegacyEvidence(raw, metadata)
await writeNewJson(path.resolve(outputPath), evidence)
console.log(`Wrote sanitized evidence: ${path.resolve(outputPath)}`)
