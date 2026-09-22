import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const resolvePath = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolvePath('./src'),
    },
  },
  build: {
    target: 'es2022',
    cssTarget: 'chrome111',
    rollupOptions: {
      input: {
        main: resolvePath('./index.html'),
        terms: resolvePath('./legal/terms.html'),
        privacy: resolvePath('./legal/privacy.html'),
      },
    },
  },
});
