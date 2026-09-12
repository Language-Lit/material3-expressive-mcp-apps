import { build } from 'esbuild'
import { copyFile, mkdir } from 'node:fs/promises'
await mkdir('deploy/sandbox/dist', { recursive: true })
await build({
  entryPoints: ['deploy/sandbox/server.ts', 'deploy/sandbox/ticket.ts'],
  outdir: 'deploy/sandbox/dist', outExtension: { '.js': '.mjs' },
  bundle: true, platform: 'node', format: 'esm', target: 'node24',
})
await copyFile('playground/generated/proxy.html', 'deploy/sandbox/dist/proxy.html')
console.log('Built the standalone sandbox service and server-side ticket helper.')
