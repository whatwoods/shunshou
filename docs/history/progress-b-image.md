# B 批 · 图像进度

已实现 6 个工具页面（没有改 image-compress 或全站归属文件），通用组件在 `src/components/kit/ImageWorkbench.*`，处理逻辑在 `src/lib/image/`，重处理均在独立 Worker 串行批量执行。

- `/image/convert`：批量转换 PNG/JPEG/WebP/AVIF/GIF 首帧/BMP，质量设置、单张/ZIP 下载。HEIC/HEIF 使用已获许可的 libheif-js 1.23.5 本地 WASM 解码。不支持 HEIC 输出，UI 与 meta 已写清。
- `/image/resize`：按比例、宽高包围盒、长边；可保持比例，Lanczos 3 缩放，批量下载。
- `/image/crop`：拖动移动裁剪框，数字调节边界，1:1/4:3/16:9/9:16/3:4/4:5 比例与 1080×1080/1440/1350/1920 社交尺寸预设、旋转、翻转、处理结果预览与下载。旋转预览先在 Worker 生成，避免 CSS 变换和实际裁剪坐标不同。
- `/image/exif`：读取相机/时间/GPS 等元数据，GPS 警示。JPEG/PNG/WebP 直接修改结构清理 EXIF/XMP/文字信息，保留色彩配置；仅重新插入显示必需的 Orientation，不保留拍摄隐私。批量清除下载。
- `/image/watermark`：文字/图片水印，大小、透明度、五种位置与平铺，批量输出。
- `/image/svg`：SVGO 浏览器版多轮优化，精度、ID 清理、移除尺寸可调，前后图片与体积对比。

依赖（已 npm view 查询版本/维护信息）：
- `@jsquash/resize` 2.1.1，Apache-2.0，成熟 WASM Lanczos；复用仓库 `@jsquash/avif` 2.1.1。
- `svgo` 4.1.0，MIT，2026-08-24 更新，使用 `svgo/browser`。
- `exifr` 7.1.3，MIT，2023-08-03 更新，维护较慢但元数据解析成熟，避免自行实现复杂 EXIF。
- `gifenc` 1.0.3，MIT，2023-07-28 更新，轻量调色板 GIF 编码，音视频工具也共用。
- `libheif-js` 1.23.5，LGPL-3.0，用户第二轮明确许可后直接安装；`heic-decode` 不再使用。
- 自写 BMP 24 位编码（结构简单，免加依赖）；JPEG/PNG/WebP 元数据结构清理（不重新编码像素，保留画质）。

验证：图像新增 8 个纯逻辑测试（尺寸边界、BMP 行对齐、JPEG/WebP 清理、仅保留方向），全仓测试当前 107/107 通过。全仓 `npm run typecheck`、`npm test`、`npm run build` 均通过（2026-10-11 本次最后验证）。ImageWorkbench 独立分包约 13.43 KB，主包不引入图像解码器。主代理集成后可再次确认最终构建。

局限：HEIC 输出未实现；GIF 仅静态首帧、透明区铺白；大尺寸整帧解码仍需要对应像素内存。尚未做浏览器视觉验收（依约用户人工验收）。无 docs/requests.md 请求。第二轮新增图片拼接、图片取色，见下方。

## 第二轮（2026-10-11）

- 用户已明确允许 LGPL HEIC 解码依赖。已按锁流程直接安装 `libheif-js` 1.23.5，`npm view` 核对最近维护时间 2026-10-04、LGPL-3.0。只使用原发行 `libheif-wasm/libheif.js` 与本地 `libheif.wasm?url`，无源码改写；按需动态加载，解码入口抽到 `src/lib/image/decode.ts`。
- 已删除 `docs/heic-wasm-pending.patch` 与 `.md`。页面现在说明支持 HEIC/HEIF 输入，仍不支持 HEIC 输出。许可来源：用户第二轮明确批准；上游 https://github.com/catdad-experiments/libheif-js ，许可证及源码链接由主代理汇总到 licenses.md。
- 新增 `/image/stitch`：横向或竖向拼接、统一宽/高并保持比例、间距与背景、拖放和按钮排序、PNG/JPEG 下载。自写布局计算，原生 OffscreenCanvas Worker 处理；适合截图长图、照片组合，避免第三方上传。
- 新增 `/image/palette`：图片主题色提取（2–16 色）、点选像素/键盘坐标取色、HEX/RGB/CSS 复制、调色板 PNG 下载。复用 gifenc 1.0.3 的量化器，自写颜色格式与界面；透明像素不参与主题色统计。
- 8 个图像页面统一接 `useHandOff`（只接收文件入状态，显式按钮才开始处理，避免 StrictMode 丢任务）与 toast 下载/复制反馈。
- 新增拼接布局边界与颜色格式 5 个测试；阶段测试全仓 133/133 通过。当前全仓 typecheck/build 被 AV/PDF 代理施工的类型错误阻塞，图像自身无错误。
- 真实 HEIC 验证通过：`/System/Library/Desktop Pictures/Mac Blue.heic`（9,282,587 bytes）复制到项目 `.image-heic-test.heic`，用原版 libheif-js 1.23.5 + WASM Node 实例解码得到 6016×6016、144,769,024 RGBA bytes；红通道最小 0 最大 249，36,192,256 像素 alpha=255。临时文件已删除。此验证确认实际 WASM 解码，不等同于浏览器 CSP 运行验收。

- 第二轮收口：ImageExtras 用 busyRef 阻止处理中追加/重排，卸载后停止 Worker 且不写入状态，参数和列表变化清除旧结果；调色板预览最长边 1600，像素取色仍读取原始图。`npm run typecheck` 已通过，`npm run build` 通过；最后全仓测试 132/133，唯一失败为并行 PDF 压缩测试预期页面宽度 400、实际 310，已反馈主代理。图像测试全部通过。
