# B 批：音视频进度

更新：2026-10-11，第二轮。7 个 AV 工具已完成。所有页面复用 `src/components/kit/AvWorkbench`，处理代码位于 `src/lib/av/`，未修改 Claude 归属文件，未启动开发服务器。

## 工具

- `/av/gif`：起止片段、5–30 FPS、320–1280 px 宽度、256 色 PNN 自适应调色板、可选有序抖动、GIF 预览下载。累计舍入 GIF 帧时长，避免 12 FPS 等设置累计漂移；最多 1800 帧。
- `/av/compress`：MP4/H.264、WebM/VP9，分辨率上限、0.2–12 Mbps 码率、估算和实际体积。保留帧率，主音轨 AAC/Opus 128 kbps。探测原生编码能力，未预期丢轨直接报错。
- `/av/audio`：提取主音轨，输出 MP3/WAV/M4A/OGG。MP3/AAC/Opus 提供 64–320 kbps 码率设置，WAV 为 PCM。
- `/av/trim`：双范围时间轴和数值输入、播放选段。快速模式强制流复制，起止可能扩展到相邻关键帧（已明确提示）；精确模式按选区处理，必要时重编码。
- `/av/frame`：原尺寸 PNG/JPEG、JPEG 画质、真实时间戳前后逐帧定位、区间按间隔截帧 ZIP，显示实际帧时间。最多 500 张、合计输出最多 512 MB。
- `/av/audio-edit`（新增）：音频选段试听、精确起止、MP3/WAV/M4A/OGG 转换及码率。补日常剪音频、做短提示音与转换格式需求。
- `/av/convert`（新增）：MP4/H.264/AAC 与 WebM/VP9/Opus 转换，顺时针 90/180/270 度旋转，可去除音轨。兼容编码直接复制，必要时才转码。转换时允许整个时间轴平移以匹配目标容器，保持音画同步。

## 交互与线程

所有工具支持文件选择、全窗口拖入/粘贴、公共 `useHandOff`、设置记忆、进度、取消、错误反馈、预览和下载。下载调用公共 `toast('已开始下载')`。音频文件使用原生 audio 控件；视频使用 video 控件。

公共 useHandOff 同步消费文件，AV 回调将处理延至微任务，并检查挂载状态，避免 StrictMode 清理轮取消唯一文件请求。已有真实 React StrictMode + 公共 hook + AvClient 的回归测试：只创建一个 Worker，只提交一次 load，成功显示文件名及音轨元数据，卸载后终止 Worker。

解复用、编解码、GIF 调色板、截帧、ZIP 打包在 Worker；输入 BlobSource 按需读取。换文件、取消和卸载会终止 Worker；对象 URL 随预览文件释放。Worker 构造失败也显示明确错误。没有修改公共 hook。

## 依赖与许可

- `mediabunny@1.61.3`，MPL-2.0，npm 最近修改 2026-10-05。使用 WebCodecs 和 Conversion/CanvasSink，无大体积 ffmpeg runtime，无 SharedArrayBuffer 要求。源码 https://github.com/Vanilagy/mediabunny 。
- `gifenc@1.0.3`，MIT，npm 最近修改 2023-07-28。更新少，但零依赖、小体积、成熟 PNN 量化及真实 GIF 编码测试，适用于这里的 Worker 编码。复杂视频仍受 GIF 256 色限制。
- `@mediabunny/mp3-encoder@1.61.3`（本轮新增），包装及桥接 MPL-2.0，内部 LAME 3.100 为 LGPL-2.0-or-later。按本轮明确许可采用，未修改组件。npm 最近修改 2026-10-05。包装源码 https://github.com/Vanilagy/mediabunny/tree/main/packages/mp3-encoder ；LAME 来源 https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz ；官方说明 https://lame.sourceforge.io/license.txt 。已下载官方源包核对 COPYING（Library GPL v2）及 libmp3lame/lame.c 的 version 2 or any later 声明。上游构建禁用 decoder，不包含 GPL mpglib 解码器。
- MP3 扩展只在实际输出 MP3 且没有原生编码器时动态加载。Worker 与 WASM 内嵌同一独立 JS，不请求 CDN/外链，不依赖 SharedArrayBuffer。检索浏览器分支未发现 eval()/new Function。Node 专用 worker_threads 分支的 `{ eval: true }` 不会在浏览器执行；浏览器使用 CSP 已允许的 blob Worker 和 wasm-unsafe-eval。
- 复用 `fflate@0.8.3`；自写少量范围校验、采样、尺寸/体积估算及抖动，避免额外通用依赖。
- 安装使用 `.npm-lock`，锁已释放。主代理统一维护 `docs/licenses.md`，准确 LAME 版本及源地址已发送。

## 测试与构建

AV 包含 9 个测试文件，18 项测试：范围/采样上限、尺寸与体积、GIF 编码、PCM 转换、H.264/AAC 关键帧无损截取、真实 0.5 秒音频选段、LAME MP3 编码与重读、旋转静音后编码 packet 不变、VP9/Opus MP4 转 WebM 保留双轨，以及 StrictMode handoff。

真实媒体 fixture 都由本机 FFmpeg testsrc2/sine 生成，不使用外部素材。线上不包含 FFmpeg：
- `av-trim/fixtures/clip.mp4`：4 秒 64×48 H.264/AAC，19,466 字节。
- `av-convert/fixtures/vp9-opus.mp4`：1 秒 64×48 VP9/Opus，仅测试用，不会进入线上包。

08:28 全局 typecheck 通过，build 通过。构建中 MP3 独立 chunk 311.53 kB，AvWorkbench UI 14.68 kB，均远低于 25 MiB；首页入口 276.47 kB，没有静态导入 AV 编解码代码。libheif 的 Node 模块 externalized 提示属于图像库。

08:29 随后复跑，AV 测试继续全过；其他代理正修改 PDF，遇到 PDF 测试的类型错误与 jsdom ResizeObserver fixture 问题，已通知主代理。最终全局结果由主代理整批收尾更新。视觉/交互按约定由用户人工验收，没有声称完成各浏览器实机验证。

## 已知限制

- 原生解码和 AAC/Opus/H.264/VP9 编码支持依赖浏览器及系统；不支持时明确提示换格式或新版浏览器。MP3 使用本地 LAME fallback。
- MP3 输出统一 44.1 kHz、最多双声道（界面已说明），编码器帧填充可能使解析时长增加数十毫秒；精确 PCM 选段有 0.5 秒验证。
- 输入按需读取，输出 BufferTarget 仍暂存内存，极大输出受设备内存限制。GIF 与截图已有数量上限。
- 处理主音视频轨，不保留多语言次音轨和字幕。
- 无需要修改 Claude 归属文件的请求，本轮未改 `docs/requests.md`。
