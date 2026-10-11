# 第三方组件许可证

核对日期：2026-10-11。依据 `package-lock.json`、安装包的 package.json / LICENSE / README，以及下列上游源码。这里列出 MIT、BSD、Apache、ISC 之外的 npm 许可证、双许可例外，以及 HEIC / MP3 编码器内部的 LGPL 组件；常规 MIT/BSD/Apache/ISC 包仍保留其上游许可声明。

本项目没有修改下列组件的上游源码。HEIC 和 MP3 扩展是独立按需加载的组件，不进入首页入口：HEIC 的 JS 工厂与原始 WASM 分开打包；MP3 扩展保持上游封装，其 Worker 与 WASM 包含在独立动态 JS 分包中。构建器会正常转换模块/压缩 JS，但没有对第三方源码作功能补丁。所有运行资源由本站提供，不从下列源码链接在线加载；源码链接用于获取源代码、许可证与重建说明。

## 浏览器中使用

| 组件、版本 | 用途与加载方式 | 许可证 | 源码与声明 |
| --- | --- | --- | --- |
| libheif-js 1.23.5 | HEIC/HEIF 解码；用户处理 HEIC 时在图像 Worker 中加载，WASM 为独立本地文件 | LGPL-3.0 | [JS/WASM 发行与构建源码](https://github.com/catdad-experiments/libheif-js)、[许可证](https://github.com/catdad-experiments/libheif-js/blob/master/LICENSE) |
| libheif、libde265（libheif-js 所含编解码底层） | HEIF 容器与 HEVC 解码；随上述未修改 WASM 分发，不用于 HEIC 编码 | LGPL-3.0 / LGPL-3.0-or-later，以发行所含源码声明为准 | [libheif 源码](https://github.com/strukturag/libheif)、[libheif 许可证](https://github.com/strukturag/libheif/blob/master/COPYING)、[libde265 源码](https://github.com/strukturag/libde265)、[libde265 许可证](https://github.com/strukturag/libde265/blob/master/COPYING) |
| mediabunny 1.61.3 | 音视频解析、转换、剪辑；独立媒体 Worker，打开工具才加载 | MPL-2.0 | [源码](https://github.com/Vanilagy/mediabunny)、[许可证](https://github.com/Vanilagy/mediabunny/blob/main/LICENSE) |
| @mediabunny/mp3-encoder 1.61.3 | MP3 编码适配器；选择 MP3 输出时动态加载，保留上游 Worker/WASM 封装 | MPL-2.0（适配器）；内部 LAME 另见下一行 | [源码及编译步骤](https://github.com/Vanilagy/mediabunny/tree/main/packages/mp3-encoder)、安装包 `LICENSE` |
| LAME 3.100 | MP3 编码；包含在上述独立加载组件中，未修改 | LGPL-2.0-or-later（COPYING 为 GNU Library GPL v2，lame.c 声明 v2 或更新版本） | [项目主页与致谢](https://lame.sourceforge.io/)、[3.100 源码下载](https://sourceforge.net/projects/lame/files/lame/3.100/lame-3.100.tar.gz/download)、[官方许可说明](https://lame.sourceforge.io/license.txt) |
| mdn-data 2.27.1、2.0.28 | CSS 语法数据，随 SVGO/CSS 优化依赖进入 SVG 工具分包 | CC0-1.0 | [源码与 LICENSE](https://github.com/mdn/data) |
| sax 1.6.1 | XML/SVG 解析，随相关工具依赖打包 | BlueOak-1.0.0 | [源码与 LICENSE](https://github.com/isaacs/sax-js) |
| dompurify 3.4.16 | A 批 Markdown/HTML 净化；工具分包 | MPL-2.0 OR Apache-2.0（可选择 Apache-2.0） | [源码与 LICENSE](https://github.com/cure53/DOMPurify) |

MP3 仅使用 LAME 编码器。扩展的上游编译步骤包含 `--disable-decoder`，不启用 LAME 中旧 mpglib 解码路径；MP3 输入由媒体库和浏览器解码。LAME 是 MP3 输出能力的提供者，特此致谢。

用户已明确批准本项目使用 HEIC 的 LGPL 解码器和 LAME LGPL 编码器。需要替换或重建这些组件时，使用对应版本源代码及上游编译步骤，并保持本地资源路径与调用接口兼容；仓库没有对替换后的库设置校验封锁。

## 仅开发、构建、测试或部署工具

这些依赖不随网站工具发送给浏览器。平台变体合并列出，具体安装平台以 lockfile 为准。

| 组件、版本 | 用途 | 许可证 | 源码 |
| --- | --- | --- | --- |
| lightningcss 及全部 lightningcss-* 平台包 1.33.0 | Vite CSS 构建 | MPL-2.0 | [parcel-bundler/lightningcss](https://github.com/parcel-bundler/lightningcss) |
| @img/sharp-libvips-* 1.3.4（darwin、linux、linuxmusl 平台变体） | Wrangler/Sharp 的本机图像依赖 | LGPL-3.0-or-later | [发行与构建源码](https://github.com/lovell/sharp-libvips)、[libvips 源码](https://github.com/libvips/libvips) |
| @img/sharp-wasm32、@img/sharp-win32-* 0.35.5 | Sharp 可选 WASM/Windows 平台依赖 | Apache-2.0 AND LGPL-3.0-or-later，wasm32 另含 MIT | [sharp 源码](https://github.com/lovell/sharp)、[libvips 发行构建](https://github.com/lovell/sharp-libvips) |
| @speed-highlight/core 1.2.24 | 开发错误展示与代码着色 | CC0-1.0 | [speed-highlight/core](https://github.com/speed-highlight/core) |
| lru-cache 11.5.3 | 开发依赖缓存 | BlueOak-1.0.0 | [isaacs/node-lru-cache](https://github.com/isaacs/node-lru-cache) |
| @csstools/color-helpers 6.1.2、@csstools/css-syntax-patches-for-csstree 1.1.15 | jsdom/CSS 测试依赖 | MIT-0 | [csstools/postcss-plugins](https://github.com/csstools/postcss-plugins) |
| wrangler 4.149.0、@cloudflare/kv-asset-handler 0.5.0、@cloudflare/unenv-preset 2.16.2 | 本机预览、部署、Cloudflare 适配 | MIT OR Apache-2.0 | [cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk) |

Sharp 的 libvips 二进制包含自己的传递组件；版本清单保存在各包的 `versions.json`，许可证与重建来源以 [sharp-libvips 发行仓库](https://github.com/lovell/sharp-libvips) 的构建材料为准。它们仅用于开发工具，不属于本站 HEIC 或 MP3 的浏览器实现。

网站上的入口是 `/licenses`（页脚“开源许可”），许可全文放在 `public/licenses/`，随构建发布；升级上表组件时同步改 `src/pages/Licenses.tsx`。

更新依赖时应重新扫描 lockfile 的 `license` 字段，并核对嵌入 WASM 的底层库，不能仅凭 npm 包外层许可证判断。

## 新增的常规许可依赖（只记用途）

| 组件、版本 | 用途与加载方式 | 许可证 | 源码 |
| --- | --- | --- | --- |
| gpt-tokenizer 4.0.0 | 字数统计页的 Token 数，只引入 o200k 分词表（约 2.4 MB），在单独的 Worker 里第一次统计时才加载；没有 eval / new Function | MIT | [niieani/gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) |
| onnxruntime-web 1.30.0 | 抠图工具在浏览器里跑模型；Worker 里按需加载，WebGPU 版 wasm 拆两块（见 scripts/models/README.md） | MIT | [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) |

## 模型和图片

| 内容 | 用途 | 许可 | 来源 |
| --- | --- | --- | --- |
| U²-NetP（u2netp.onnx） | 抠图“快速”档，原样使用 | Apache-2.0（全文在 public/licenses/Apache-2.0.txt，网站 /licenses 页列出） | [xuebinqin/U-2-Net](https://github.com/xuebinqin/U-2-Net)，文件取自 [rembg 发行页](https://github.com/danielgatis/rembg/releases/tag/v0.0.0) |
| ISNet 通用版（isnet-general-use.onnx） | 抠图“精细”档；只留最终输出、权重 fp16 存储，改动说明见 scripts/models/README.md | Apache-2.0 | [xuebinqin/DIS](https://github.com/xuebinqin/DIS)，文件取自 rembg 发行页 |
| 小岛航拍照片（MrDuck Tail 摄） | 图片压缩空状态的背景图，压成 1800px WebP | [Unsplash License](https://unsplash.com/license)，不要求署名 | [unsplash.com/photos/5W5hBhCFnV4](https://unsplash.com/photos/small-island-in-green-water-5W5hBhCFnV4) |
