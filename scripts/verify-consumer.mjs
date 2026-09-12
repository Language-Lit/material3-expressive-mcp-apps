import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
const specifier = process.argv[2]
assert(specifier, 'Supply a .tgz path or published package version.')
const react = process.argv[3] ?? '19.3.0'
const directory = await mkdtemp(path.join(tmpdir(), 'm3e-consumer-'))
const target = specifier.endsWith('.tgz') ? `file:${path.resolve(specifier)}` : specifier
await writeFile(path.join(directory, 'package.json'), JSON.stringify({
  name: 'm3e-release-consumer', private: true, type: 'module', dependencies: {
    '@language-lit/material3-expressive-mcp-apps': target,
    '@language-lit/material3-expressive': '1.2.2',
    '@modelcontextprotocol/client': '2.0.0', '@modelcontextprotocol/ext-apps': '2.0.0',
    react, 'react-dom': react,
  }, devDependencies: { typescript: '^5.9.0', '@types/react': react.startsWith('18.') ? '^18.3.0' : '^19.0.0', '@types/react-dom': react.startsWith('18.') ? '^18.3.0' : '^19.0.0' },
}, null, 2))
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: directory, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Consumer command exited ${code}`)))
  })
}
await run('npm', ['install', '--strict-peer-deps', '--ignore-scripts', '--no-fund', '--no-audit'])
await run('npm', ['ci', '--strict-peer-deps', '--ignore-scripts', '--no-fund', '--no-audit'])
await writeFile(path.join(directory, 'smoke.mjs'), `
import assert from 'node:assert/strict';
import { McpAppFrame, buildContentSecurityPolicy } from '@language-lit/material3-expressive-mcp-apps';
import { McpAppProvider, useMcpApp } from '@language-lit/material3-expressive-mcp-apps/app';
assert.equal(typeof McpAppFrame, 'function');
assert.equal(typeof McpAppProvider, 'function');
assert.equal(typeof useMcpApp, 'function');
assert(buildContentSecurityPolicy().includes("connect-src 'none'"));
assert(import.meta.resolve('@language-lit/material3-expressive-mcp-apps/styles.css').endsWith('/dist/styles.css'));
`)
await writeFile(path.join(directory, 'smoke.ts'), `
import type { McpAppFrameProps } from '@language-lit/material3-expressive-mcp-apps';
import type { McpAppProviderProps } from '@language-lit/material3-expressive-mcp-apps/app';
const authorize: McpAppFrameProps['onAuthorizeToolCall'] = async ({ name }) => name === 'approved';
const active: McpAppFrameProps['active'] = false;
const mode: McpAppProviderProps['colorMode'] = 'system';
void [authorize, active, mode];
`)
await run('node', ['smoke.mjs'])
await run('npx', ['tsc', '--noEmit', '--skipLibCheck', '--target', 'es2022', '--module', 'nodenext', '--moduleResolution', 'nodenext', 'smoke.ts'])
const installed = JSON.parse(await readFile(path.join(directory, 'node_modules/@language-lit/material3-expressive-mcp-apps/package.json'), 'utf8'))
assert.deepEqual(Object.keys(installed.exports).sort(), ['.', './app', './styles.css'])
assert.equal(Object.keys(installed.dependencies ?? {}).length, 0)
console.log(`Consumer passed: package ${installed.version}, React ${react}, strict peers, npm ci, JS/CSS/types. ${directory}`)
