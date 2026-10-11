import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// 宣传片是单独的一个入口，复用网站的样式、图标和玻璃算法，但不进网站的构建
const here = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: here,
  plugins: [react()],
  server: { port: 5190, fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  // 工具页的懒加载入口（import.meta.glob）不需要预构建，只扫宣传片自己
  optimizeDeps: { entries: ['main.tsx'] },
  build: { outDir: 'dist', target: 'es2022', emptyOutDir: true }
});
