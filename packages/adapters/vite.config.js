import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      // 配置多入口点
      entry: {
        'index': resolve(__dirname, 'src/index.ts'),
        'vue': resolve(__dirname, 'src/vue.ts'),
        'react': resolve(__dirname, 'src/react.ts'),
        'angular': resolve(__dirname, 'src/angular.ts')
      },
      formats: ['es'],
      fileName: (format, entryName) => {
        // ES模块使用.mjs扩展名
        return `${entryName}.mjs`;
      }
    },
    rollupOptions: {
      // 将所有依赖设置为外部依赖
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'vue',
        '@angular/core',
        '@grid-table/core'
      ]
    }
  }
}); 