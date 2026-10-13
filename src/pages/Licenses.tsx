import { Nav } from '../components/Nav';
import { Link } from '../router';

// 第三方组件许可：随网站一起发布（LGPL 要求接收者能拿到许可全文和源码获取方式）。
// 全文放在 public/licenses/，版本和 docs/licenses.md 保持一致；升级依赖时两处一起改
const PARTS: { name: string; version: string; use: string; license: string; texts: [string, string][]; source: string }[] = [
  {
    name: 'libheif-js（含 libheif、libde265）',
    version: '1.23.5',
    use: '打开 iPhone 的 HEIC 照片。只在处理 HEIC 时加载，WebAssembly 文件独立存放，可以替换',
    license: 'LGPL-3.0',
    texts: [
      ['LGPL-3.0 全文', '/licenses/LGPL-3.0.txt'],
      ['GPL-3.0 全文', '/licenses/GPL-3.0.txt'],
      ['libheif 许可说明', '/licenses/libheif.txt']
    ],
    source: 'https://github.com/catdad-experiments/libheif-js'
  },
  {
    name: 'LAME',
    version: '3.100',
    use: '导出 MP3。只在选 MP3 输出时加载，未修改',
    license: 'LGPL-2.0-or-later',
    texts: [['GNU Library GPL v2 全文', '/licenses/LGPL-2.0.txt']],
    source: 'https://sourceforge.net/projects/lame/files/lame/3.100/'
  },
  {
    name: 'mediabunny、@mediabunny/mp3-encoder',
    version: '1.61.3',
    use: '音视频的读取、转换和剪辑',
    license: 'MPL-2.0',
    texts: [['MPL-2.0 全文', '/licenses/MPL-2.0.txt']],
    source: 'https://github.com/Vanilagy/mediabunny'
  },
  {
    name: 'ISNet 通用抠图模型（DIS）',
    version: 'isnet-general-use',
    use: '抠图的“精细”档。只保留最终输出、权重改成 fp16 存储，拆成 4 块；只在抠图时加载',
    license: 'Apache-2.0',
    texts: [['Apache-2.0 全文', '/licenses/Apache-2.0.txt']],
    source: 'https://github.com/xuebinqin/DIS'
  },
  {
    name: 'U²-NetP 抠图模型',
    version: 'u2netp',
    use: '抠图的“快速”档，未修改；只在抠图时加载',
    license: 'Apache-2.0',
    texts: [['Apache-2.0 全文', '/licenses/Apache-2.0.txt']],
    source: 'https://github.com/xuebinqin/U-2-Net'
  },
  {
    name: 'ONNX Runtime Web',
    version: '1.30.0',
    use: '在浏览器里运行抠图模型；WebGPU 版的 wasm 拆成两块，未修改',
    license: 'MIT',
    texts: [],
    source: 'https://github.com/microsoft/onnxruntime'
  },
  {
    name: 'DOMPurify',
    version: '3.4.16',
    use: 'Markdown 和 HTML 预览前清理危险代码',
    license: 'MPL-2.0 或 Apache-2.0（本站按 Apache-2.0 使用）',
    texts: [],
    source: 'https://github.com/cure53/DOMPurify'
  }
];

export function Licenses() {
  return (
    <div className="tool-page">
      <Nav />
      <LicenseContent />
      <footer className="tool-foot">顺手 · 文件只在你的设备上处理</footer>
    </div>
  );
}

export function LicenseContent() {
  return (
    <main className="tool-main licenses">
      <h1>开源许可</h1>
      <p className="licenses-lead">
        顺手用到了下面这些开源组件，感谢它们的作者。其余依赖是 MIT、BSD、Apache、ISC 这类宽松许可，声明保留在打包后的代码里。
      </p>
      <div className="licenses-list">
        {PARTS.map((p) => (
          <section key={p.name} className="licenses-item">
            <h2>
              {p.name} <small>{p.version}</small>
            </h2>
            <p>{p.use}</p>
            <p className="licenses-meta">
              <span>{p.license}</span>
              {p.texts.map(([label, href]) => (
                <a key={href} href={href} target="_blank" rel="noreferrer">
                  {label}
                </a>
              ))}
              <a href={p.source} target="_blank" rel="noreferrer">
                源代码
              </a>
            </p>
          </section>
        ))}
      </div>
      <p className="licenses-note">
        LGPL 组件都是原样使用、单独加载的：可以用对应版本的源代码按上游说明重新编译，替换网站里同名的文件。LGPL-3.0 是在 GNU GPL 第 3
        版上加的补充条款，所以两份全文都附在上面。
      </p>
      <p className="licenses-note">
        <Link to="/">‹ 回到首页</Link>
      </p>
    </main>
  );
}
