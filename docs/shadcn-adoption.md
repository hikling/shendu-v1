# shadcn/ui 组件接入

组件通过官方 `shadcn@4.23.0` CLI 导入，配置为 `new-york`、Radix、React/JavaScript；源码在 `shendu/ui/components/ui/`，配置在 `shendu/components.json`。它们以真实 React 组件运行，由 Vite 和 Tailwind 编译为本地资源。代码与许可可以在仓库内直接审阅。

## 页面覆盖

| 页面或控件 | 使用的组件 | 保留的业务契约 |
| --- | --- | --- |
| 登录、注册、账户、动态偏好和阶段设置 | Card、Button、Input、Textarea、RadioGroup、Label、Checkbox | 原有表单字段、校验、权限和提交接口；颜色设置已移除 |
| 六类沉浸式复盘 | Button、Input、Textarea、RadioGroup、Label、Calendar | 所有问题的输入持续挂载；切题、收起答案、保存及错误重试不丢内容 |
| 验证日期 | Calendar（React DayPicker）、Button | 中文日期、六周高度、原日期字段、各类最早可选日期、历史只读 |
| 阶段与日历 | Calendar、Progress、Button、Card | 原始记录身份、草稿／完成／验证状态、统计跳转和阶段设置 |
| 历史复盘、行动验证 | Card、Badge、Button、Input、NativeSelect、Dialog、Textarea | 分类插画、原筛选、完整正文、验证规则和退出后返回来源 |
| 顶部账户与手机菜单 | DropdownMenu、Button | 相同入口及权限、方向键、Escape、关闭后焦点恢复 |
| 确认、验证、登录过期弹窗 | Dialog | 持久登录保护、保存中禁止退出、父子弹窗焦点 |
| 备份与管理员页面 | Card、Table、Button、Input、RadioGroup、Checkbox、Badge、Dialog | 原加密、预览、恢复、权限及确认流程 |
| 错误、状态、加载和通知 | Alert、Badge、Skeleton、Progress、Sonner | 原有真实状态与错误信息，无额外数据请求 |

设置、阶段与日历、阶段配置和指南采用普通工作区页面，共用暖纸背景和插画标题。日历为月历与阶段/待验证双栏，手机自然重排；没有阶段 Dialog、Tabs 或侧装饰卡。月历保持原记录身份、状态、统计及返回日期焦点；公历与本地计算的农历/节气双行显示，日期格以明确表格布局对齐。格子td.rdp-day与按钮rdp-day_button分离，防止表格规则污染按钮；状态图例在右上，月份居中夹在箭头间。六类复盘的浅到类别色静态渐变由共享画布CSS负责，组件输入表面与固定配色保持。顶部仍为透明文字导航，当前项用字色和独立焦点轮廓表示。

## 定制界面的保留范围

概览六类图标的命中区域、弧形轮播及其副本、品牌按钮、打字机标题、插画与画布继续由原有代码管理。它们的几何和动画不对应通用 Carousel 或 Card；类别介绍里的普通进入按钮仍采用 Button。答案条目与设置模板的原生 `details/summary` 保留全部已挂载输入及 `.open` 行为，其内部字段和操作按钮使用组件。

表格采用 Table 外层，行与单元格作为不透明的原生内容保留，避免在 `table/tbody` 中插入无效挂载元素。隐藏字段保持原生；文件、颜色和日期输入通过 Input 保留浏览器原有行为。勾选框使用真实 shadcn/Radix Checkbox，另一个不可见、不可聚焦的原生字段维护旧代码的 `.checked`、`FormData` 和单次 input/change 事件。

## 渲染与样式边界

`ui/runtime.jsx` 是唯一挂载登记表。现有页面生成 HTML 后，`renderMarkup()` 先清理子组件，再同步挂载组件，最后由业务代码绑定事件。Card、Label 和 Button 中的旧模板内容由原生代码管理；React 不重复管理同一子节点列表。自绘区域通过明确的选择器或 `data-ui-native` / `data-ui-skip` 声明边界。

复杂交互在 `ui/surfaces.jsx` 中显式组合。Dialog、DropdownMenu、RadioGroup 和 DayPicker 各自负责键盘与焦点行为，原有重复处理已移除。组件控件仍使用原始 ID、name 和 data 属性；没有数据模型迁移。

应用、功能确认框、通知分别挂在 body 下的 `#app`、`#modal-root`、`#toast-root`；兼容 `#rail-root` 不再挂载页面。`syncOverlayBackground()` 只在实际功能 Dialog 存在时管理应用 inert。新一轮弹框替换空挂载容器，避免旧 Radix 隐藏快照；不手动修改 aria-hidden 或增加 Tab 陷阱。完整登录重置清理功能弹框；持久重认证保留编辑内容。

Sonner 在初始化业务界面前挂载，使其既有 polite live region 在首个弹框及嵌套弹框中保持可用。编辑器日期、保存等状态有局部播报，不为整个应用添加 aria-live。Calendar 使用中文、固定六周和原 YYYY-MM-DD 字段；浏览月份不改值，显式选择才派发一次输入事件，锁定历史保留原月并禁止导航。

`ui/styles.css` 仅导入 Tailwind theme/utilities，不导入 Preflight。组件语义色映射现有纸色、墨色、固定品牌配色和类别颜色；`--ui-muted` 与原正文的 `--muted` 分开。`compat.css` 和 `surfaces.css` 处理挂载层、组件布局与原页面的衔接。已确认的红印章、宋体、六类配色、插画和概览构图继续保留。

`display:contents` 挂载层仍是真实 DOM 祖先；旧 CSS 的直接子选择器需要显式适配，不能据此假定宿主不存在。配对输入标签、验证时间 Badge、只读附记 Card 和窄屏列表／表格均保留对应样式。可访问名称、可见焦点及旧账户颜色被忽略后的固定配色对比必须在真实页面核查。

## 构建与部署

在 `shendu/` 执行 `npm ci`，使用锁文件安装依赖；`npm run build` 生成被 Git 忽略的 `public/ui/`。`npm start`、`npm run dev` 和 `npm test` 均先构建。Docker 在独立阶段安装与编译，运行镜像只复制编译资源，无需 CDN。`/ui/licenses.txt` 随构建生成，保留实际打包依赖的许可。

更新组件和主脚本时同时更新 `public/index.html` 及 `app.js` 中的资源版本，避免浏览器沿用旧的 immutable 缓存。CI 检查实际容器的 HTML、主脚本和组件 JS/CSS，不仅检查 API 健康。

`npm run check` 检查原生脚本语法，`npm test` 先执行生产构建，再运行原有领域／安全测试及组件真实 DOM 回归。当前为 JavaScript 项目，没有独立 TypeScript 或 ESLint 配置；JSX 编译由 Vite 构建覆盖。DOM 测试覆盖字段／FormData、单次事件、保留隐藏答案、勾选框、菜单、日历、持久与嵌套弹窗、背景 inert、焦点恢复及登录清理；视觉、真实浏览器焦点和移动端边界另行验收。接口、记录、加密、权限和验证等待规则不因组件采用而改变。

填写类单值 select 的可见界面为真实 shadcn/Radix RadioGroup 选项组。历史类型、年份、月份是明确例外，已恢复真实 shadcn NativeSelect 的紧凑布局，保留原生标签、值、禁用、焦点、表单和单次事件语义及一个装饰箭头。原生字段隐藏但持续挂载，维持 name/id/value/FormData、required、禁用、重置与单次 input/change；标签和错误聚焦转到可见选项。直接展示的选项多时自动换行；历史月份在未选年份时仍禁用。组件来源核对官方 new-york-v4 radio-group 源码；见[本轮验收](page-choice-qa/README.md)。
