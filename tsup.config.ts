import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    app: 'src/app/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@language-lit/material3-expressive',
    /^@modelcontextprotocol\/(?:ext-apps|client|core|server)(?:\/.*)?$/,
  ],
})
