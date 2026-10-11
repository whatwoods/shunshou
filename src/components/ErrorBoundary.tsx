import { Component, type ReactNode } from 'react';
import { Link } from '../router';
import { Nav } from './Nav';

// 工具页面崩溃时只影响这一页：给出说明和重试，导航和其他工具照常可用
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    // 分包加载失败：多半是网站刚更新、这个标签页还是旧版本，刷新就好
    const stale = /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch/i.test(
      this.state.error.message
    );
    return (
      <div className="tool-page">
        <Nav />
        <main className="tool-main" style={{ textAlign: 'center', paddingTop: 180 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{stale ? '网站刚更新过，这一页要刷新一下。' : '这一页出了点问题。'}</h1>
          <p style={{ margin: '12px auto 0', maxWidth: 520, fontSize: 16, color: 'var(--ink-2)' }}>
            {stale
              ? '这个标签页还是旧版本，刷新一下就好。文件一直只在这台设备上。'
              : '文件没有上传，也没有丢，都还在这台设备上。重新打开这一页再试试。'}
          </p>
          <p style={{ margin: '8px auto 0', maxWidth: 520, fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
            {this.state.error.message}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24 }}>
            <button type="button" className="btn" onClick={() => location.reload()}>
              重新打开
            </button>
            <Link to="/#tools" className="btn btn-soft">
              看看别的工具
            </Link>
          </div>
        </main>
      </div>
    );
  }
}
