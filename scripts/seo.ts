import { createServer, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

export function seoPages(state: { routes: string[] }): Plugin {
  let mode = 'production';
  let root = process.cwd();
  return {
    name: 'shunshou-seo',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      mode = config.mode;
      root = config.root;
    },
    async generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (index?.type !== 'asset') throw new Error('SEO 构建缺少 index.html');
      // 只加载共享说明与工具清单；不执行工具页面，也不把编解码依赖带入构建渲染。
      const server = await createServer({
        configFile: false,
        root,
        mode,
        cacheDir: 'node_modules/.vite-seo',
        optimizeDeps: { noDiscovery: true, include: [] },
        plugins: [react()],
        server: { middlewareMode: true, watch: null },
        appType: 'custom'
      });
      try {
        const { renderAssets } = await server.ssrLoadModule('/src/seo/render.tsx');
        const { files, routes } = renderAssets(String(index.source)) as { files: Record<string, string>; routes: string[] };
        index.source = files['index.html'];
        for (const [fileName, source] of Object.entries(files)) {
          if (fileName !== 'index.html') this.emitFile({ type: 'asset', fileName, source });
        }
        // 供紧接着执行的 Service Worker 插件使用，不额外发布路由配置文件。
        state.routes = routes;
      } finally {
        await server.close();
      }
    }
  };
}
