import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { forgetLegacyContent } from './lib/store';
import { toast } from './components/Toast';
import './styles.css';

forgetLegacyContent();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// 工具里按需加载的模块取不到：多半是网站刚更新、这个标签页还是旧版本。只提示，不自动刷新，免得冲掉正在编辑的内容
window.addEventListener('vite:preloadError', () => toast('网站刚更新，部分功能要刷新后才能用。刷新前先保存好手上的结果。', 'error'));

// 离线缓存只在正式构建里启用，开发时不注册，免得缓存旧代码
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
