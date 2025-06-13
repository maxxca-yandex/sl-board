import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server/server.node.ts'],
  outDir: 'dist/server',
  format: ['esm'],
  target: 'node18',
  bundle: true,
  splitting: false,
  shims: false,
  dts: false,
  external: [],
})
