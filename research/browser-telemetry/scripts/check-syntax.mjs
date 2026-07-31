import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const roots = ['lib', 'poc', 'scripts', 'tests']
const files = []
for (const root of roots) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(path.join(entry.parentPath, entry.name))
    }
  }
}
files.sort()

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    process.stderr.write(result.stdout)
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
  console.log(`Syntax OK: ${file}`)
}
