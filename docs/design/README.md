# 设计稿（参考用）

这些是设计规范 E 的画板源文件，用一种模板语法写成（`{{…}}` 是数据，`<sc-for>` / `<sc-if>` 是循环和条件，底部 `<script>` 里的 `renderVals()` 是示例数据和交互逻辑）。`/_blob/…` 是画布里的折射贴图，真实应用里由 `src/components/Glass.tsx` 运行时生成，不需要这些文件。

- `FusionStyleguide.dc.html`：颜色、钴蓝按钮、LED、液态玻璃规则、字号、控件。
- `FusionPdfMerge.dc.html`：合并 PDF（按文件 / 按页面两种视图、拖动排序、输出选项、底部玻璃工具栏）。
- `FusionJsonFormat.dc.html`：JSON 格式化（格式化 / 压缩、缩进、键名排序、出错提示与一键修复、玻璃状态标签）。
- `FusionDropAnywhere.dc.html`：在首页任意位置拖入文件后，按文件类型推荐工具。

只参考布局、信息层级和交互；颜色要换成 `src/styles.css` 里的 CSS 变量。
