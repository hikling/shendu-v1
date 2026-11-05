# 历史复盘实现说明

## 修改范围

- `shendu/public/app.js`：仅 `historyCardHtml()` 和 `renderHistory()` 的呈现模板。
- `shendu/public/history-archive.css`：新增历史页专用样式，交由主会话在入口中接入。

## 排版变化

卡片明确使用伸展的整宽上下行，消除 shadcn Button 默认 `items-center` 对 opaque span 产生的居中散落。类别与真实状态在顶部两端对齐；日期与自定义标题同属左侧顶部正文，170px 类别插画锚定右下；底部意图文字与“翻开复盘”箭头两端对齐。卡片取消固定最低高度，短卡按约 260—285px 的自然内容排版，长标题可增长；宽屏两列，820px 及以下一列。页头插画列同步从230px降至180px，减少首屏高度。

沿用 `overviewRecordTitle()` 与 `overviewDateParts()`：默认日期仅显示一次；日期式标题的每日日期／完整星期分行，自定义标题有独立安静的周期行。长标题与摘要沿用列表预览的三行限制，原始完整文字仍在 DOM 和原记录中；具体记录数据不改。标题、摘要、日期、状态、ID 与图片路径继续转义。

页头移除图片下重复装饰句，缩短说明；筛选区成为同一暖白纸面上的独立工具带。标题、配图、底部状态、筛选、空结果样式全部在 `.history-page` 下作用，不改变行动验证、概览、日历或沉浸复盘。

## 保留行为

筛选 projection、`state.historyFilter`、搜索 input caret、type/year/month/reset 事件、`data-open-record`、原记录ID及 `bindRecordOpen()` 均未改。`recordArtAssignments(state.records)` 仍先对全量记录分配，再过滤；不添加持久化图片字段。真实 Badge/Button 仍由既有组件岛增强。

## 已运行检查

- `npm run check`：通过。
- `node --test tests/overview-reel.test.mjs tests/review-navigation.test.mjs tests/ui-runtime.test.mjs`：35/35 通过，涵盖日期归一化、来源返回、native 按钮事件与组件宿主。
- `git diff --check`：通过。

本实现者未声称视觉验收完成。主会话负责整体构建、实际浏览器桌面／窄屏／过滤／来源返回／主题和焦点验收、截图、独立审查与 main 同步。一个重复的测试标签在进入历史页面前已关闭，没有调整窗口尺寸，也未修改隔离数据库。
