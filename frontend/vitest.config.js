import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/api.test.js'],
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
