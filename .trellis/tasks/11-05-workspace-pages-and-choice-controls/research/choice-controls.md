# 直接选择控件实现

## 官方来源

2026-11-05通过HTTPS实际读取并核实 `https://ui.shadcn.com/r/styles/new-york-v4/radio-group.json`，registry文件为 `registry/new-york-v4/ui/radio-group.tsx`。本地 `ui/components/ui/radio-group.jsx`沿用其真实 `RadioGroupPrimitive.Root/Item/Indicator` 和 CircleIcon，移除TypeScript类型、改为本地cn路径，并为Item增加children以呈现完整选项文字。依赖使用项目已有 `radix-ui`，没有新增包。许可证沿用组件目录的shadcn MIT声明。

## 行为与责任

- `ui/runtime.jsx`把所有应用中的单值select增强为直接可见、自然换行的RadioGroup，不弹出浏览器下拉层。原生select仍拥有id/name/value/required/disabled和FormData，屏幕与键盘顺序只显示RadioGroup。
- 每次实际选择只在原select上分发一次input和change；重复点当前值不重新标脏。外部带input/change事件的value更新、form.reset可同步可见状态，不重挂载字段。
- 真实原生required检查保留；invalid事件取消隐藏控件的浏览器提示并聚焦可见选项，选择后清除可见错误状态。标签推断会移除选项文字，支持for关联、包裹label与.field相邻label。
- 初始/动态select禁用和祖先fieldset禁用均同步；observer只读取disabled/required/aria-invalid属性，未做节点重挂载或另建root registry。选项原本disabled继续不可选。
- 应用没有多值select；通用适配保留原生multiple的页内列表与多值契约（它本身不产生下拉弹层）。
- `ui/choice-controls.css`隐藏原生选择箭头；每日状态组使用整行宽度，历史筛选让搜索/类别占宽行、年/月自然换行；手机堆叠，较长选项不撑开文档。只为选中态用轻微类别色填充，hover改描边/文字、保留可见焦点和减少动态。

## 验证

- `npm run build`通过，使用既有依赖成功构建真实RadioGroup组件。
- `node --test tests/ui-choice-controls.test.mjs tests/ui-runtime.test.mjs`：13/13通过，其中新增5项实际DOM测试覆盖单次事件/FormData、required/聚焦、动态禁用/fieldset、外部值/reset/隐藏节点保留、Radix箭头键及文本安全。
- `npm run check`通过；`git diff --check`通过（仅LF/CRLF提示）。
- 旧runtime测试将“第一个button”断言改为实际shadcn Button，避免新增RadioGroup按钮被误当成提交按钮，并补充Radix使用的HTMLFormElement jsdom全局。
- 还需主会话完整测试、浏览器视觉/窄屏/只读/历史筛选验收和缓存版本更新。未修改app.js、页面surface、index、服务器或依赖，没有commit/push。
