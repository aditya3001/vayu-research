import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // api.test.js uses node; AuthContext.test.jsx needs jsdom.
    // We split them via workspace-style per-file env overrides using
    // a single pool but let each file declare its own environment via
    // the @vitest-environment docblock.
    environment: 'node',
    globals: true,
    include: ['src/api.test.js', 'src/auth/AuthContext.test.jsx'],
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--max-old-space-size=4096'],
      },
    },
    server: {
      deps: {
        // Externalize everything in node_modules so vite-node doesn't transform them;
        // only our own src/ files are transformed by vite. This avoids OOM from
        // processing the large firebase package tree.
        external: [/node_modules/],
      },
    },
  },
})
