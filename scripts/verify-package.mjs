import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))

// The published contract: a host entry, an app entry and the stylesheet, no
// runtime dependencies, and every protocol and design-system package as a peer.
assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './app', './styles.css'])
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'Runtime dependencies are forbidden')
for (const peer of [
  '@language-lit/material3-expressive',
  '@modelcontextprotocol/client',
  '@modelcontextprotocol/ext-apps',
  'react',
  'react-dom',
]) {
  assert.ok(pkg.peerDependencies[peer], `Missing peer: ${peer}`)
}
assert.equal(pkg.peerDependenciesMeta, undefined, 'Every peer is required')

// The identity announced to apps is the package's own.
const identity = readFileSync(path.join(root, 'src/internal/package.ts'), 'utf8')
assert.match(identity, new RegExp(`PACKAGE_NAME = '${pkg.name.replace('/', '\\/')}'`), 'PACKAGE_NAME')
assert.match(identity, new RegExp(`PACKAGE_VERSION = '${pkg.version.replace(/\./g, '\\.')}'`), 'PACKAGE_VERSION drifted from package.json')

function graph(entry) {
  const sources = new Map()
  const external = new Set()
  function visit(file) {
    if (sources.has(file)) return
    const source = readFileSync(file, 'utf8')
    sources.set(file, source)
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    function walk(node) {
      let specifier
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text
      if (specifier) {
        if (specifier.startsWith('.')) visit(path.resolve(path.dirname(file), specifier))
        else external.add(specifier)
      }
      ts.forEachChild(node, walk)
    }
    walk(ast)
  }
  visit(path.join(root, 'dist', entry))
  return { sources, external }
}

// The built entries may reach only the peers, and only the browser entries of
// the extension SDK. `@modelcontextprotocol/client` is a type-level peer: the
// frame accepts a `Client` but never constructs one, so it must not appear in
// the built code at all. `zod` and `@modelcontextprotocol/ext-apps/server`
// belong to servers and never to a browser bundle.
const allowedExternal = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@language-lit/material3-expressive',
  '@modelcontextprotocol/ext-apps',
  '@modelcontextprotocol/ext-apps/app-bridge',
])
const hostEntry = graph('index.js')
for (const name of hostEntry.external) {
  assert.ok(allowedExternal.has(name), `Unexpected external import in dist/index.js: ${name}`)
}
const appEntry = graph('app.js')
for (const name of appEntry.external) {
  assert.ok(allowedExternal.has(name), `Unexpected external import in dist/app.js: ${name}`)
  assert.notEqual(name, '@modelcontextprotocol/ext-apps/app-bridge', 'The app entry must not carry host code')
}
for (const entry of ['index.js', 'app.js']) {
  assert.match(readFileSync(path.join(root, 'dist', entry), 'utf8'), /^['"]use client['"];?/, entry)
}

const designSystemEntries = [
  '@language-lit/material3-expressive',
  '@language-lit/material3-expressive/theme',
  '@language-lit/material3-expressive/tokens',
  '@language-lit/material3-expressive/styles.css',
]
const protocolEntries = [
  '@modelcontextprotocol/ext-apps',
  '@modelcontextprotocol/ext-apps/app-bridge',
  '@modelcontextprotocol/client',
]

function checkSources(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name)
    if (item.isDirectory()) { checkSources(file); continue }
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    if (/\.tsx?$/.test(file)) {
      const imports = ts.preProcessFile(source).importedFiles.map((entry) => entry.fileName)
      for (const name of imports) {
        if (name.startsWith('@language-lit/material3-expressive')) {
          assert.ok(designSystemEntries.includes(name), `Deep import into the design system in ${file}: ${name}`)
        }
        if (name.startsWith('@modelcontextprotocol/')) {
          assert.ok(protocolEntries.includes(name), `Only the browser entries of the MCP SDKs may be imported (${file}): ${name}`)
        }
        assert.notEqual(name, 'zod', `zod must stay behind the SDKs (${file})`)
      }
      // The client SDK is a type-level peer. A value import would drag the
      // whole client (and its Node transports) into the browser bundle.
      for (const statement of source.matchAll(/^import\s+(type\s+)?[^'"]*['"]@modelcontextprotocol\/client['"]/gm)) {
        assert.ok(statement[1], `Import @modelcontextprotocol/client as types only (${file})`)
      }
      assert.doesNotMatch(source, /<(?:button|input|textarea|dialog)\b/, 'Use Material controls: ' + file)
      assert.doesNotMatch(source, /dangerouslySetInnerHTML/, 'App HTML goes into the sandbox, never into the host DOM: ' + file)
    }
    if (file.endsWith('.css')) {
      assert.doesNotMatch(source, /!important|#[0-9a-f]{3,8}\b/i, file)
      for (const match of source.matchAll(/(?:^|[;{])\s*(color|background(?:-color)?|font(?!-variant-numeric)(?:-[\w-]+)?|line-height|letter-spacing|border-radius|(?:animation|transition)(?:-duration|-timing-function)?|box-shadow)\s*:\s*([^;{}]+)/g)) {
        assert.ok(/var\(--m3e-/.test(match[2]) || /^(?:none|inherit|transparent|currentColor)$/.test(match[2].trim()), 'Non-token design value in ' + file + ': ' + match[0])
      }
    }
  }
}
checkSources(path.join(root, 'src'))

// The stylesheet carries both halves of the package.
const css = readFileSync(path.join(root, 'dist/styles.css'), 'utf8')
assert.match(css, /\.m3e-mcp-frame\b/, 'dist/styles.css lacks the frame rules')
assert.match(css, /\.m3e-mcp-app\b/, 'dist/styles.css lacks the app rules')

console.log('Package boundaries, directives, dependencies, identity and design-system usage verified.')
