# 历史筛选恢复

## 改动

- `shendu/ui/runtime.jsx`：仅 `.history-page` 内的 `#history-type`、`#history-year`、`#history-month` 恢复 genuine shadcn `NativeSelect`。其他单值选择仍由直接可见 RadioGroup 接管；多选列表契约保持。
- `shendu/ui/choice-controls.css`：移除上轮为历史选项铺开展示追加的宽行/换行/尺寸规则与隐藏箭头规则。原 `history-archive.css` 已保留紧凑布局，不需再添加覆盖或重写该文件。
- `shendu/tests/ui-choice-controls.test.mjs`：增加真实 DOM 回归，覆盖三项原生筛选、标签、初始值、可聚焦性、月份禁用、FormData、单次 change、启用月份、原节点保留与表单 reset。

## 保留

`app.js` 原筛选投影与事件不改，历史的搜索、年份联动月份、筛选后返回上下文保持。`compat.css` 已将 NativeSelect 包装设为 contents、隐藏组件附带 SVG，原页面独立 chevron 继续是唯一箭头；禁用态也已有规则。桌面原一行搜索/类型/年/月，820px搜索独占一行，520px类型占一行/年与月两列。

## 检查

- `node --check tests/ui-choice-controls.test.mjs` 通过。
- 对所拥有的三个文件 `git diff --check` 通过（仅 Git LF/CRLF 提示）。
- 未运行生产构建，避免与其他工作并发覆盖产物。主会话统一 build 后执行 `node --test tests/ui-choice-controls.test.mjs tests/ui-runtime.test.mjs`，再运行全量门禁和浏览器。

## 待主会话

实际选择2026年/11月，检查原字段与筛选结果、月份禁用、键盘和手机边界；更新缓存版本与规范中“全部单值选择直接展示”的规则，明确历史筛选例外。
