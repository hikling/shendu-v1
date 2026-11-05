# 设计与实现边界

历史卡片当前是按钮模板，shadcn Button 的居中对齐影响未显式伸展的内层 span。新结构明确对齐和宽度，组织顶部类别、正文日期标题、右侧插画和底部摘要状态。日期沿用标准化工具，不改筛选、原记录ID或配图分配。

工具界面共享局部 workspace 视觉词汇：暖白与浅色纸面、宋体大标题、左文右插画、分节短标题和清楚的主要操作。备份/用户保持原路由，设置/账户保持原 Radix Dialog，不迁移路由或生命周期。设置下级主题/阶段/指南沿用对应容器与返回设置流程。新增样式只在各自空间类名作用。

继续通过 renderMarkup/enhanceUi 使用真实 shadcn islands；display:contents宿主仍是DOM祖先。保留转义、原字段name/id/data-*、autocomplete、required、禁用和权限条件，不改变表单事件、API或安全确认。

分工：历史实现者拥有 historyCardHtml/renderHistory 呈现模板和 public/history-archive.css；工具空间实现者拥有 spacePageHead 附近局部 helper、renderBackup/siteBackupSection/renderUsers 以及 openSettings/openAccount/openTheme/openStage/openGuide 呈现模板与 public/workspace-pages.css。双方在 app.js 不同函数块精确修改，不格式化整文件。主会话负责 index、缓存版本、集成验收、规范与 main。

复用已审核本地库中与功能有关的不同插画，静态 aria-hidden、pointer-events:none。独立页面CSS便于检查作用域和回滚。仅呈现修改，不需要数据迁移。
