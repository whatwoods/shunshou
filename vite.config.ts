import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { seoPages } from './scripts/seo.ts';

const seo = { routes: ['/'] };

// 构建时生成 sw.js：只预缓存首页要用的入口脚本、样式和图标；各工具的分包、wasm、字体在第一次用到时再缓存
function serviceWorker(): Plugin {
  return {
    name: 'shunshou-sw',
    apply: 'build',
    // 放到最后，index.html 已经在 bundle 里，版本号能算上它的内容
    enforce: 'post',
    generateBundle(_, bundle) {
      const shell = new Set<string>();
      const visit = (file: string) => {
        const item = bundle[file];
        if (!item || shell.has(file)) return;
        shell.add(file);
        if (item.type === 'chunk') {
          item.imports.forEach(visit);
          item.viteMetadata?.importedCss.forEach((css) => shell.add(css));
          item.viteMetadata?.importedAssets.forEach((asset) => shell.add(asset));
        }
      };
      for (const [file, item] of Object.entries(bundle)) if (item.type === 'chunk' && item.isEntry) visit(file);
      const precache = ['/', '/favicon.svg', '/manifest.webmanifest', '/theme.js', ...[...shell].sort().map((f) => '/' + f)];
      // 带哈希的文件名变了版本就变；index.html 和 public 里不带哈希的文件要把内容也算进去
      const hash = createHash('sha256').update(precache.join('\n'));
      for (const [file, item] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        if (item.type === 'asset' && file.endsWith('.html')) hash.update(file).update(item.source);
      }
      for (const f of ['favicon.svg', 'manifest.webmanifest', 'theme.js'])
        hash.update(readFileSync(new URL('./public/' + f, import.meta.url)));
      const version = hash.digest('hex').slice(0, 10);
      // 这次构建的全部带哈希文件：新版本激活时，缓存里不在名单上的旧分包会被清掉
      const assets = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/'))
        .sort()
        .map((f) => '/' + f);
      const source = readFileSync(new URL('./scripts/sw.template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(precache))
        .replace('__ROUTES__', JSON.stringify(seo.routes))
        .replace('__ASSETS__', JSON.stringify(assets));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    }
  };
}

export default defineConfig({
  plugins: [react(), seoPages(seo), serviceWorker()],
  worker: { format: 'es' },
  resolve: {
    alias: {
      // 抠图的 WebGPU 运行时用“不内嵌 glue”的版本：内嵌版会用 new URL 把 26.8 MB 的 wasm 打包进来，超过 Cloudflare 单文件上限。
      // 这个版本的 glue 和 wasm 都由 image-cutout/worker.ts 自己提供（wasm 拆成两块放在 runtime/）
      'onnxruntime-web/webgpu-extern': new URL('./node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs', import.meta.url).pathname
    }
  },
  // jSquash 用 new URL(..., import.meta.url) 加载 .wasm，预构建会弄丢这些路径
  optimizeDeps: { exclude: ['@jsquash/avif', '@jsquash/webp', '@jsquash/jpeg', '@jsquash/oxipng', 'onnxruntime-web'] },
  build: { target: 'es2022' }
});
