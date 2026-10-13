# 顺手 · 给编码代理的约定

顺手是一个纯前端的小工具箱：所有文件都在用户的浏览器里处理，不上传。部署在 Cloudflare Workers 的静态资源上，没有后端。

技术栈：Vite 8 + React 19 + TypeScript 7（`tsc` 是原生版，很快）。没有 UI 框架，样式是手写 CSS + CSS 变量。

## 常用命令

- `npm run typecheck`：类型检查
- `npm test`：vitest 单元测试（node 环境）
- `npm run build`：类型检查 + 生产构建
- `npm run dev`：开发服务器（http://localhost:5173）
- `npm run preview`：用 wrangler 在本机跑正式构建（会应用 `public/_headers` 里的安全策略）
- `npm run format`：Prettier 统一格式（配置在 `.prettierrc.json`；`src/styles.css` 等一行一条规则的样式表不参与）

## 加一个工具

工具按文件夹自动注册，**不需要改 `src/tools.ts` 或 `src/App.tsx`**。

1. 文件夹名是 `<分类 id>-<路径名>`，例如 `src/tools/pdf-merge/`，对应地址 `/pdf/merge`。分类 id：`office` `code` `image` `av` `pdf` `data`。
2. `Page.tsx`：默认导出页面组件。只要这个文件存在，首页和 ⌘K 就会把工具当作“已上线”，并按需懒加载。
3. `src/tools.ts` 的 `RAW` 里已经列了计划中的工具（名称、键帽字、描述、关键词）。新增清单外的工具，在文件夹里放 `meta.ts`，默认导出 `ToolMeta`（`{ cat, name, mark, desc, keywords }`）；也可以用它覆盖清单里已有工具的文案。`meta.ts` 会被首页同步加载，里面只放这份文案，不要放别的代码。
   - 排序：分类按常用程度排（办公、PDF、图像、音视频、开发、数据，见 `CATEGORIES`），分类内按 `ORDER` 排，没列进去的排在最后。新工具记得把 id 插到 `ORDER` 里合适的位置。
   - `POPULAR`：最常用的几个工具。⌘K 没有最近记录时显示它们；正式环境里浏览器空闲时只预加载这几个页面（不含大依赖）。
   - 键帽上的图标：在 `src/components/ToolIcon.tsx` 的 `TOOL` 里按工具 id 加一项（规则见下面“视觉规范”），开发服务器里打开 `/docs/icon-preview.html` 和其他图标放在一起看，浅色深色（`?theme=dark`）都看。没画之前首页和 ⌘K 显示 `mark` 的字，不影响上线。
   - 如果工具能接收文件，把它加进 `src/lib/match.ts` 里对应文件类型的推荐列表（按常用程度排），首页拖入、手机“打开一个文件”和处理完的“接着用”都会推荐它。
4. 页面外层用 `ToolPage`：`<ToolPage tool={toolById('pdf-merge')!} sub={…} actions={…}>…</ToolPage>`。它负责导航、面包屑、标题、页脚，以及记录“最近使用”。
5. 工具私有的样式放在工具文件夹里的 `.css`，在 `Page.tsx` 里 import（会跟着工具一起拆包）。
6. 在 `src/seo/guides-media.ts` 或 `guides-text.ts` 里补齐工具的真实能力、3 步操作、使用限制和相关工具。说明会同时显示在工具页和构建出的 HTML 中；不要写未经实现验证的格式支持或效果承诺。

## SEO 与静态页面

- `src/seo/metadata.ts` 统一管理路由元信息；页面组件不要再单独写 `document.title`。构建由 `scripts/seo.ts` 在 Service Worker 生成前输出各路由 HTML、站点地图和纯文本目录，工具仍按需加载。
- `src/site.ts` 的 `url` 或构建变量 `VITE_SITE_URL` 是正式域名的唯一来源。自行部署必须改成自己的 HTTPS 根地址。
- Cloudflare 使用 `404-page` 和 `drop-trailing-slash`，不使用统一首页回退；未知路径返回 404，未上线工具不进 sitemap。Service Worker 按路由缓存页面，不能再把所有页面写入 `/`。
- 结构化数据必须对应可见内容，不添加虚构评分、作者或日期，不为 SEO 放宽 CSP。`llms.txt` 只是补充目录，不能当作收录保证。

参考实现：`src/tools/image-compress/`（Worker 池、拖放、对比视图、批量下载）。

## 可复用的部件

- `src/components/ui.tsx`：`Glyph`（小键帽：传 `tool`，画好图形的工具显示 `ToolIcon`，没画的显示 `mark` 的字）、`Led`（状态小灯：done / work / error / idle）、`Kbd`、`Segmented`（可 `disabled`）、`SegField`（带标题的小号分段按钮，放在一排设置里）、`Field`（设置分组里“标题 + 控件”的一行）、`Slider`、`SwitchRow`、`ExampleButton`（“试试示例”），以及一组线性图标（搜索、加减、下载、关闭、上下左右箭头 `Arrow*Icon`、旋转 `RotateIcon`、复制 `CopyIcon`、拖动把手 `GripIcon` 等），以及网站标志 `LogoMark`（暖橙底上四个圆角方块，左上那块亮着、带绿色小灯；不放文字。和 `public/favicon.svg`、`public/*.png` 是同一个图形，改一处要同步其他几处）。
- `src/components/ToolIcon.tsx`：工具图标 `ToolIcon`、分类图标 `CatIcon`（手机首页）、文件类型图标 `KindIcon`（每种文件一个，按分类着色）。
- `src/components/Glass.tsx`：液态玻璃。只用在浮在内容上的元素（浮动工具栏、状态标签、提示层），**不要**拿来做普通卡片。全站只有三种：`kind="bar"`（导航、手机顶栏、标签栏、浮动工具栏这些能点的胶囊，默认）、`kind="sheet"`（⌘K、拖入弹层、下拉菜单、底部操作栏、轻提示）、`kind="clear"`（压在照片上的胶囊和手柄）。折射参数、底色、阴影、镜面高光（左上沿亮、右下沿回光、顶部柔光、指针/手指下的亮斑）都由 `Glass` 和 `styles.css` 的 `.lg` / `.lg-<kind>` 统一给出；元素自己的 CSS 只写尺寸排版，要换底色或阴影改 `--lg-tint` / `--lg-shadow`，不要直接写 `background` / `box-shadow` / `backdrop-filter`，也不要自己再拼一套玻璃。玻璃元素本身不能是滚动容器（高光会跟着内容滚走），要滚就在里面再套一层（参考 `.picker-scroll`、`.anywhere-body`）。Chromium 里是真折射：边缘透镜 + 红绿蓝分开偏移的色散 + 弧面高光，其他浏览器退回磨砂玻璃加同一套高光。`bar` 和 `clear` 按下去会鼓起、松手回弹（Web Animations 改 `scale`/`translate`，不碰元素自己的 `transform`）；手柄这类自己收不到指针事件的，传 `pressed`。**玻璃的祖先元素不能挂着停住的动画**：入场动画只写 `from`，填充模式用 `backwards`，不要用 `both`/`forwards`，否则 Chromium 里玻璃读不到背后的页面，折射和磨砂全部失效，看起来就是一块透明板（手机标签栏就踩过这个坑）。
- `src/components/Lens.tsx`：iOS 26 那种液态玻璃拖动动效，手机标签栏、`Segmented`、`SwitchRow`、`Slider`、工具页里画成开关的复选框（`CheckLens`，在 `App` 里挂一次，整页接管）共用。选中块平时是控件里一块实心胶囊（thumb），按住浮起变成放大的玻璃透镜（lens），跟手、走快了拉长压扁、松手吸到最近一格并回弹；位置由弹簧逐帧写 `style`，**thumb 上不要再加 CSS transition**。透镜用 portal 挂在 `body` 上，因为祖先里的玻璃或 `overflow: hidden` 会让它读不到背后的页面（还会叠出重影）或被裁掉。松手后浏览器补发的那次 click 要拦掉（`justReleased()` 只拦一次），键盘切换（click 的 `detail` 为 0）只滑不浮。新做“几选一”或开关类控件时直接用这几个组件，不要自己再写一套。开关和滑块的钮是 iOS 27 式的横向椭圆（宽 ≈ 高 × 1.58）：开关轨道 64×28、钮 38×24，工具页小开关 52×23、钮 30×19，滑块钮 38×24；改尺寸要同步 `styles.css`、`Lens.tsx` 的 `switchSlots` 和 `Slider` 的 `KNOB`（滑块的原生圆钮也要一样宽，否则拖动时值和手指对不上）。
- `src/components/DropZone.tsx`：`DropZone`（空状态里的选文件卡片，单独用时电脑上最宽 760px 居中，放进工作台预览位时传 `className="in-layout"`；图标和颜色按 `accept` 自动选）和 `DropOverlay`（拖着文件经过窗口时的提示层）。
- `src/router.tsx`：`Link`、`navigate`。页面里的“返回”按钮一律用 `<Link to={没有上一页时去哪} back>`（或 `goBack(fallback)`）：本站里有上一页就 `history.back()`，和系统返回手势一致；没有才替换成 fallback。不要拿普通 `Link` 当返回，否则每按一次都压一条新记录，系统返回会在两页之间打转。平级切换（底部标签栏）用 `replace`。`usePrevious()` 给出上一页地址，返回按钮上写它的名字。
- `src/lib/useFileDrop.ts`：整个窗口接收拖入和粘贴的文件。
- `src/lib/useHandOff.ts`：`useHandOff(addFiles)`。首页“拖入任意位置 → 推荐工具”和 ⌘K 会把文件带到工具页，**所有接收文件的工具都要调用它**，否则用户从首页过来时文件会丢。
- `src/components/Toast.tsx`：`toast('已复制')`、`toast('出错了', 'error')`。复制、下载、清空这类没有明显界面变化的操作完成后，用它给一个轻提示。
- `src/lib/files.ts`：`fmtSize`、`saveBlob`、`saveZip`（在 Worker 里流式打包，返回 Promise，失败要给提示）、`pickFiles`、`copyText`、`baseName`、`today`。
- `src/lib/store.ts`：本机偏好的读写（`load` / `save`，键名自动加 `shunshou:` 前缀）、最近使用和收藏（`useLocalLists`、`toggleStar`、`timeAgo`），以及首页/⌘K 向工具页传文件的 `handOff(files, 目标路径)` / `takeHandOff`。一定要带目标路径，否则在别的工具页上发起时，文件会被当前页接走。工具页用 `useHandOff` 接收，它已处理 StrictMode，不需要再包一层延后。
- `src/lib/settings.ts`：`usePersisted(key, 默认值, 内容字段?)` → `[值, 设置, 重置]`。**工具设置一律用它**（各套件的 `usePreference` / `useCodeSettings` 也是基于它）：自动存到本机，改过之后标题旁会出现“恢复默认”。只存设置，不要存用户的内容：查找替换的词、水印文字、前后缀、输出文件名这类用户输入如果和设置放在同一个对象里，就列进第三个参数（只留在内存、不算改动、恢复默认时不动）；SQL 这类正文直接用 `useState`。运行脚本这类有风险的开关不要记住。
  - 结果要和产生它的设置绑在一起：记下生成时的设置签名，显示前比对（参考 `code-id`、`code-format`），这样“恢复默认”、普通改设置、处理中途回来的旧结果都不会和当前设置对不上。处理中调用 `useSettingsLock(busy)` 锁住“恢复默认”（`CodeStatus`、`Status`、`DataPage` 和几个工作台已经接好）。
- `src/lib/useShortcuts.ts`：`useShortcuts({ run, save, cancel })`，对应 ⌘/Ctrl+Enter、⌘/Ctrl+S、Esc。处理函数返回 `false` 表示这次不处理，按键交还浏览器。套件的 `CodeOutput` / `OutputActions` 已经接好 ⌘S。
- `src/lib/useModal.ts`：`useModal(ref, onClose)`，模态弹层用：焦点移进来、Tab 在里面循环、背后设 `inert`、Esc 关闭、关掉后焦点还回去。新做弹层直接用它。
- `src/lib/useMedia.ts`：`useMedia(PHONE)`、`useMedia(TOUCH)`。触屏上不要写“拖入”“⌘K”这类用不了的说法。
- `src/lib/match.ts`：`kindOf(file)` 认文件类型，`matchFiles(files, 当前工具)` 给出推荐分组和“合成一份”这类组合建议。推荐列表里的工具必须真能读这种格式：iPhone 的 HEIC 很常见，读图片一律先 `createImageBitmap`、失败再用 `src/lib/image/decode.ts` 的 WebAssembly 解码（HEIC、AVIF）；TIFF 多数浏览器打不开，不按图片推荐。
- `src/lib/image/animated.ts`：`isAnimated(file)` 认出 GIF、APNG、动画 WebP。只能处理第一帧的图片工具，加文件时要在列表和提示里说清楚“只保留第一帧”，不能悄悄把动图变成静态图。
- `src/components/FileMatch.tsx`：`FileChip({ file })` 显示一个已选文件（类型图标 + 文件名 + 大小），工具页里“已选择 xxx”一律用它；`NextSteps({ outputs, from })`，处理完以后的“接着用”，把结果交给下一个工具。
- `src/components/ActionBar.tsx`：`ActionBar`（贴在底部的玻璃操作条：状态 + 清空/添加/开始/下载）和 `KeyHint`。有文件以后再出现；它必须是工具内容的最后一个元素，否则吸底会失效。
- 文件类工具的版式（宽屏方案 B）：从空状态起就是“预览位 + 右侧设置栏”，没有文件时 `DropZone className="in-layout"` 占住预览位，设置栏照常显示（可以先选好设置），放进文件后版式不跳；≤900px 时只显示 `DropZone`，设置栏等有文件再出现。参照 `ImageWorkbench`、`PdfWorkbench`、图片压缩页。整页只用一条左对齐的轴，多出来的宽度留给背景，不要把控件拉宽或居中成窄条。有文件后是“预览 + 设置分组（`.group`）”，底部是 `ActionBar`，完成后显示 `NextSteps`。和当前设置无关的选项直接隐藏（比如输出无损格式时不显示质量）。
- 文字类工具的版式（`OfficeKit` 已改完，代码、数据套件待跟进）：`TextLayout` 左边主区、右边设置栏（`side`，和文件工具同一套方案 B）。主区里原文和结果用 `TextBox` / `Panel` 两张白卡片并排（包在 `.tw-pair` 里，主区不到 760px 自动上下排），卡片标题行左边写名字、右边放这张卡片的操作：原文是“打开文件”（`onFiles`）、“试试示例”、“清空”，结果是“复制 / 下载”（`output`）。设置一律放进设置栏的 iOS 分组：开关用 `SwitchRow`，2–4 个选项用 `Field` + `Segmented`，更多选项用 `ChoiceList`（单选列表），输入框用 `Field`，分组用 `SideGroup`。不要再把开关和带标题的控件混排在一行里。
- 文字类工具：输入框空着时给一个“试试示例”（`TextBox` 的 `example`、`DataImport` 的 `sample`，或直接用 `ExampleButton`），示例要能一眼看出效果。
- **不要用浏览器原生外观的控件**：下拉一律用 `src/components/Select.tsx` 的 `Select`（写法和 `<select>` 一样，只改标签名；放进 `.field-row` 会自动变成 iOS 设置式的右侧取值）；选文件用按钮 + `pickFiles`（文字工具给 `TextBox` 传 `onFiles`，标题行会出现“打开文件”），不要放 `<input type="file">`；颜色、进度条、`details` 的展开箭头、数字框已由全局样式处理。
- 手机（≤640px）上工具页自动换成 `src/components/PhoneBar.tsx` 的玻璃胶囊顶栏（“‹ 分类”返回 + 收藏 + 搜索）和大标题，胶囊和桌面导航是同一种 `bar` 玻璃；顶栏不能做成透明的，滚动后背后也不能垫实底（只做轻微糊开的滚动边缘），否则看不出玻璃；触屏上 `DropZone` 会把“把…拖到这里”换成“从手机里选…”，自己写的文案也不要出现“拖”。
- 选项栏（`.code-actions` / `.office-row` / `.data-controls`）里的控件统一 38px 高、底边对齐，标题一律写在控件上方；“打开文件”用 `btn btn-tint`（主色调的浅底）。
- 单行输入框和下拉按钮同一个样子：`var(--track)` 灰底、无边框、圆角 11px；多行文本框按所在位置决定（白卡片里用灰底，页面底色上用白底）。
- 卡片放在页面底色（`--bg-warm`）上必须用 `var(--surface)` 白底；不要用 `--surface-2` 或 `--bg-warm` 做卡片底色，否则卡片看不见、里面的内容平白缩进一截。`fieldset` 的浏览器默认样式已在全局清掉，只拿它整组禁用。
- 宽屏上内容少的东西不要拉满整行：空状态卡片、导入卡片限宽；单独一个按钮按内容宽（`.ce-stack` 里已处理）；标签下单独一个下拉框最宽 360px（全局已处理）；取色器这类小控件不参与平分。
- 一组开关（多选算法、清洗规则之类）用等宽网格排，不要 flex 换行，否则换行后上下对不齐。
- 页面级按钮通过 `ToolPage` 的 `actions` 传入：桌面放在标题那一行最右、和标题中线对齐，手机放在副标题下面。
- 对齐用脚本量，不要凭截图目测：逐页检查同一行控件的顶边/中线/底边、同类控件高度、卡片左右边是否和内容栏齐、小灯和图标按钮是否被拉变形。
- 表单控件：优先用 `ui.tsx` 的 `Segmented` / `SegField`（2–4 个选项）、`Slider`、`SwitchRow`。没换成组件的原生 `select`、`input[type=range]`、`input[type=checkbox]`，在 `.tool-main` 里会被全局样式统一成规范 E 的外观（勾选框显示为开关）；确实需要原生勾选框外观时加 `class="native"`。
- CSS 类：`.btn`（暖橙主按钮）、`.btn-soft`（可以单独使用）、`.btn-lg`、`.icon-btn`、`.link-btn`、`.group`（iOS 设置式分组）、`.group-title`、`.group-note`、`.select-row`、`.switch-row`、`.seg`、`.kbd`、`.glyph`、`.led`。

需要新的通用部件时，先看上面这些能不能直接用或扩展；确实是新东西，放在 `src/components/kit/`（工具套件）或 `src/components/`（全站通用）。

## 视觉规范（设计规范 E）

- 以 Apple 式的克制为主：白色和暖灰底、系统字体、大留白、圆角 18–26px。强调色是暖橙（接近 Claude 的橙色），只用在主按钮、链接和选中态；浅色模式 `--accent` 要对白底和暖灰底都 ≥ 4.5:1。
- 从“硬件风”里只保留两样：**LED 小灯**（分类色和状态）和**小键帽**（工具图标、快捷键）。
- 图标一律是 24 格的线性 SVG：线宽 1.8（很简单的勾、加号、箭头用 2），圆头圆角，`currentColor`，不填色（骰子点、码点这类小圆点除外）。工具图标画“做什么”，分类交给旁边的 LED；同一个动作在各分类里用同一个母题（压缩 = 箭头压向横线，转换 = 一圈箭头，截一段 = 方括号/剪刀）。小图形叠在大图形上时用 `cut` 挖出一圈空隙，不要直接压线。
- 按钮里不要拿文字符号当图标（← → ↑ ↓ ↻ × ＋ ⇄ 这些在不同系统上粗细、位置都不一样），用 `ui.tsx` 的图标；尺寸里的“×”、句子里的“→”是正文，不算。复制按钮带 `CopyIcon`；能拖着排序的列表加 `.drag-grip` 把手（`GripIcon`，触屏上自动隐藏），同时保留上移/下移按钮。
- **颜色一律用 CSS 变量，不要写死色值**，这样深色模式自动生效。变量定义在 `src/styles.css` 顶部，常用的有：
  - 背景：`--bg` `--bg-warm` `--surface` `--surface-2` `--field`
  - 文字：`--ink` `--ink-2` `--ink-3` `--ink-soft`
  - 线条与轨道：`--divider` `--track`
  - 强调：`--accent` `--accent-tint` `--accent-tint-2` `--btn` `--btn-shadow` `--fill`
  - 状态：`--danger` `--warning` `--success`，LED 用 `--led-done` 等
  - 玻璃：`--glass`（bar）`--glass-strong`（sheet）`--glass-clear`（clear）`--glass-ink-2` `--scrim`；高光 `--spec` `--spec-mid` `--spec-back` `--sheen` `--glint` `--lg-depth`；拖动透镜 `--lens-tint` `--lens-sheen` `--lens-shadow`
  - 代码高亮：`--code-key` `--code-str` `--code-num` `--code-lit` `--code-pun`
  - 字体：`--font` `--mono`
- 深色模式由 `<html data-theme="dark">` 切换。确实需要深色专用规则时，写在 `:root[data-theme='dark'] .你的类名 { … }` 下。
- 分类 LED 色：办公文本 `#F5A524`，开发编码 `#3B82F6`，图像 `#22B35E`，音视频 `#8B5CF6`，PDF `#F0442E`，数据 `#14A39A`。
- 动效要短、要克制（150–300ms，ease），并尊重 `prefers-reduced-motion`（全局样式已经处理了 animation 和 transition）。
- 手机宽度（375px）下不能出现横向滚动；触控目标至少 36px。
- 导航（`src/components/Nav.tsx`，电脑和平板）：`Nav` 是章节导航（品牌 · 全部工具 / 隐私 / 自行部署 · 搜索和深浅色），首页上滚到哪一节，那一项下面垫一块和分段控件选中块一样的滑块。`CatNav` 是分类导航（品牌 · 全部 + 6 个分类 · 搜索和深浅色），两种都是 `bar` 玻璃。首页工具区里的分类栏就是 `CatNav`，吸顶在 12px：它往上滚、靠近章节导航时把章节导航按比例推出屏幕（`:root` 上的 `--nav-push`），吸顶后再补出品牌和按钮，接替成导航；滚出工具区时章节导航再按比例回来。工具页顶部直接用 `CatNav`（传 `current`），当前工具的分类亮着；鼠标悬停（120ms）或点击某个分类，在它下面展开这一类的工具清单（`sheet` 玻璃，选中块跟到展开的分类上，再点一下收起，↓ 进入菜单、Esc 关闭），底部链接回首页看这一类；点“全部”回首页。
- 首页分两套：桌面 `src/pages/Home.tsx`（首屏只有一句标题、一句副标题和“把任意文件拖进来，自动匹配工具”的 `HeroDrop`，1280×640 的窗口里要能完整看到卡片；搜索框放在下面的工具区，和分类筛选在一起），≤640px 用 `src/pages/MobileHome.tsx`，严格照设计稿 E · 首页 · 手机（`docs/design` 和设计稿画布里的 FusionMobile）：大标题、搜索框、分类方块、最近使用（分类图标）、底部玻璃标签栏，`/?tab=recent|starred`、`/?cat=分类`。搜索框下面是醒目的“打开任意文件”卡片（自动认类型推荐工具，是主打功能），除此之外不要加设计稿里没有的大块元素。
- 无障碍：按钮用 `<button>`，图标按钮要有 `aria-label`，表单控件要有 label，焦点样式用全局的 `:focus-visible`。弹层里用代码移焦点（打开时聚焦输入框、关闭时还给触发按钮）一律 `focus({ preventScroll: true })`：页面锁过滚动后，Chrome 会把吸顶导航里的按钮当成被 `scroll-padding-top` 挡住，把页面往上滚一大截。

## 文案

- 中文，简短、口语、友好，像在跟朋友说话，不要术语堆砌。例子：“把图片拖到这里”“松手，开始压缩”“差一点就能解析了”。
- 能短就短：副标题一句话（15 字左右），说明文字一两句，只写会影响用户操作或决定的事；实现细节（Worker、流复制、消毒、缓存结果）不写给用户看。
- 隐私只说一次：副标题旁已经有“0 B 上传”小灯，提示、空状态、拖入层里不要再重复“不会上传”“在本机处理”。
- 同一件事全站一个说法：截断预览写“只预览前 10 万字，复制和下载是全文”（只能下载的去掉“复制和”）；空结果写“……会出现在这里”；提到界面上的选项时用它显示的名字加引号（如“精确到帧”）。
- 按钮、标签、表头不加句号；数量用“1 万”“10 万”，不写 10,000。
- 每个工具页的副标题旁边放一个 `<span className="upload-led"><Led status="done" />0 B 上传</span>`，提醒隐私。
- 出错时说清楚发生了什么、怎么办，不要只写“错误”。

## 隐私与安全（硬性要求）

- HTML 预览用 `public/html-preview-frame.html`：外层在 `sandbox="allow-scripts"`（不加 `allow-same-origin`）的 iframe 里打开，`_headers` 给它单独一套不许联网的 CSP（`default-src 'none'`）；用户的 HTML 放在它里面再套的一层 srcdoc iframe，内层必须用空 `sandbox`，始终禁用用户脚本。Chrome 会忽略 `webrtc 'block'`，单靠 CSP 无法保证用户脚本不联网，已关闭“运行脚本”模式。内层的跳转由外层 `frame-src 'none'` 限制，连本站地址也去不了。不要把用户 HTML 直接写进隔离页或父页面，不要给任何一层加 `allow-same-origin`、`allow-popups`、`allow-top-navigation`，也不要放宽 CSP。
- `public/_headers` 里的内容安全策略：`connect-src 'self'`、`script-src 'self' 'wasm-unsafe-eval'`（**没有** `'unsafe-eval'`），`worker-src 'self' blob:`，`img-src 'self' blob: data:`。所以：
  - **不能请求任何外部地址**，也不能从 CDN 加载脚本、字体或 wasm。所有依赖（包括 wasm 文件、字体、语言包）都必须通过 npm 安装、由 Vite 打包到本站。
  - 依赖内部不能用 `eval` / `new Function`。选库时要确认，必要时用 `npm run preview` 验证。
- 不加任何统计、埋点或第三方脚本。
- 没有开启 COOP/COEP，`SharedArrayBuffer` 用不了。需要多线程的库要选单线程版本或能自动降级的实现。不要为此修改响应头。
- Cloudflare Workers 单个静态文件不能超过 25 MiB。

## 性能

- 首页不能引入任何工具代码。工具只在 `Page.tsx` 里引用自己的依赖；大的库用动态 `import()`，等用户真正需要时再加载。工具卡片和 ⌘K 结果在悬停/聚焦时会预加载页面（`prefetchProps`）。
- Service Worker 由 `scripts/sw.template.js` 在构建时生成：预缓存首页，其他带哈希的文件第一次用到时缓存。新版本装好后不抢先接管（不 `skipWaiting`），等旧页面都关掉才激活，激活时删掉不在本次构建里的旧文件；旧标签页取不到新部署里已经没有的分包时，会提示刷新而不是自动刷新。
- 重活（编解码、解析大文件、哈希、PDF 渲染、音视频处理）放进 Web Worker：`new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`。worker 文件里不要用 `/// <reference lib="webworker" />`（会和 DOM 类型冲突），参考 `src/tools/image-compress/worker.ts` 的写法。
- 大文件尽量流式处理，不要一次性读进内存。
- 优先用浏览器原生能力（WebCodecs、CompressionStream、crypto.subtle、OffscreenCanvas 等）；不支持时再降级。

## 选库原则

- 优先用成熟、维护活跃、版本较新的开源实现（看最近发布时间、下载量、issue 情况）。
- 如果你有更好、性能更优的方案（比如原生 API，或比流行库快很多的小实现），可以自己写，但要在代码注释里说明理由。
- 注意许可证：只用 MIT、BSD、Apache-2.0、ISC、MPL-2.0 这类宽松许可证。GPL / AGPL 的库不要用（ffmpeg.wasm 的 core 是 LGPL，可以用，但要写清楚）。
- 引入或升级 LGPL / MPL 这类要随站附许可的组件时，同步改三处：`docs/licenses.md`、网站的 `/licenses` 页（`src/pages/Licenses.tsx`）、`public/licenses/` 里的许可全文。
- 体积要克制，按工具拆包。

## 测试与完成标准

- 纯逻辑（解析、转换、计算）要写 vitest 单元测试，放在工具文件夹里的 `*.test.ts`。jsdom 里没有 `ResizeObserver` 和 `matchMedia`，渲染用到 `Segmented` 的组件时在测试里 stub 一个。
- 每做完一个工具：`npm run typecheck` 和 `npm test` 都要通过。一批做完后跑一次 `npm run build`。
- 改完不留调试代码，不留 `console.log`。

## 协作方式

- 现在只有一个代理在维护整个项目，没有文件归属限制：哪里该改就改，但改公共部件（`styles.css`、`ui.tsx`、各个 `kit/*`）时要把用到它的页面都检查一遍。
- 安装依赖直接 `npm install <包名>`，装完说明用途、版本和许可证（写进 `docs/licenses.md`）。
- `docs/history/` 里是之前多个代理并行时的进度和评审记录，留作历史，不再更新。新的决定和已知问题直接写进本文件或代码注释。
- 改完的检查清单：`npm run typecheck`、`npm test`、`npm run build` 都通过；改了样式或版式，在 375px 和 1280px 宽度、浅色和深色下都看一遍受影响的页面。
