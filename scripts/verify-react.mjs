import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const version = process.argv[2] ?? '18.3.1'
if (!/^18\.\d+\.\d+$|^19\.\d+\.\d+$/.test(version)) throw new Error('Supply an exact React 18 or 19 version.')
const directory = await mkdtemp(path.join(tmpdir(), `m3e-react-${version}-`))
console.log(`Isolated React ${version} verification: ${directory}`)
const excluded = new Set(['node_modules', '.git', 'dist', 'generated', '.vercel'])
await cp(root, directory, { recursive: true, filter: (source) => !path.relative(root, source).split(path.sep).some((part) => excluded.has(part) || part.endsWith('.tgz')) })
const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
pkg.devDependencies.react = version
pkg.devDependencies['react-dom'] = version
if (version.startsWith('18.')) {
  pkg.devDependencies['@types/react'] = '^18.3.0'
  pkg.devDependencies['@types/react-dom'] = '^18.3.0'
}
await writeFile(path.join(directory, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: directory, stdio: 'inherit', env: { ...process.env, ...extraEnv } })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)))
  })
}
await run('npm', ['install', '--ignore-scripts', '--strict-peer-deps', '--no-audit', '--no-fund'])
await run('npm', ['run', 'verify'])
await run('npm', ['run', 'playground:build'])
for (const engine of ['chromium', 'firefox', 'webkit']) {
  await run('npm', ['run', 'test:browser'], { M3E_BROWSER: engine })
}
console.log(`React ${version} verification passed; isolated files retained at ${directory}`)
