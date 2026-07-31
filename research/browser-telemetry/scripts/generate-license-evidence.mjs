import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = process.argv[2]
if (!output) {
  console.error('Usage: node scripts/generate-license-evidence.mjs <output.json>')
  process.exit(2)
}

const root = process.cwd()
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
const dependencies = []

for (const [location, locked] of Object.entries(lock.packages ?? {})) {
  if (!location) continue
  const packageJsonPath = path.join(root, location, 'package.json')
  let installed = {}
  try {
    installed = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  } catch {
    // package-lock remains the source when an optional package is not installed on this host.
  }
  dependencies.push({
    name: installed.name ?? location.replace(/^node_modules\//, ''),
    version: installed.version ?? locked.version,
    license: installed.license ?? locked.license ?? 'NOT_DECLARED',
    development: locked.dev === true,
    optional: locked.optional === true,
    resolved: locked.resolved,
    integrity: locked.integrity,
  })
}

dependencies.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`))
const evidence = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  scope: 'research-only dependency evidence; not organizational open-source approval',
  root_package: lock.name,
  dependencies,
  disposition: 'Technical evidence generated. Dependency/license governance review remains pending.',
}
await writeFile(path.resolve(output), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'w' })
console.log(`Wrote license evidence for ${dependencies.length} package entries: ${path.resolve(output)}`)
