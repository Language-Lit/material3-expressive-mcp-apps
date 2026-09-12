// Re-add "use client" to the React entries.
//
// esbuild (via tsup) strips module-level directives when bundling with code
// splitting. Next.js only needs the directive on the module a consumer imports,
// so it is prepended to each entry file here, post-build. Both entries are
// React client code: the host frame renders an iframe and observes its size,
// the app provider talks to the host over postMessage.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const clientEntries = ['index.js', 'app.js']
const DIRECTIVE = "'use client';\n"

for (const relative of clientEntries) {
  const file = path.join(distDir, relative)
  const contents = readFileSync(file, 'utf8')
  if (contents.startsWith("'use client'") || contents.startsWith('"use client"')) continue
  writeFileSync(file, DIRECTIVE + contents)
}

console.log(`Added "use client" to ${clientEntries.length} entry file(s).`)
