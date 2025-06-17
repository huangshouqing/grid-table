import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'GridTable',
      fileName: 'index',
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: 'style.[ext]'
      }
    }
  },
}); 