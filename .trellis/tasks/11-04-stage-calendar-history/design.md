# 设计与边界

变更所有者为 app.js 的 shell/rightRail/calendarHtml/renderHistory 与 styles.css 的对应布局。index.html 更新缓存版本。无 API、数据库或数据格式变化，不改概览和沉浸填写样式。

## 阶段弹窗

复用原 backdrop/aside 与 focus/inert/Escape/嵌套弹窗机制。两侧六类 SVG 仍为不可交互的装饰；通过共用弹窗宽度和中心坐标紧贴左右边缘，卡片内侧半幅被高层弹窗遮住。可用短促 transform/opacity 实现一次伸出，并同时尊重系统与用户减少动态效果。移动端可收束为顶部半露标签，避免完整卡片再次排开；不能遮挡关闭按钮。

## 月历

保留 data-calendar-record/data-calendar/data-calendar-shift 行为与状态锚点。用深墨宋体月份、细小年份、纸白格面、足够大的日数字和显式状态符号形成层级。完成／验证用深青标记，草稿用琥珀；今天另加描边／今标记，不能覆盖已有状态。图例解释符号。无记录历史日期继续 disabled，今天可进入填写。固定六周避免切月跳动；浏览月份不写数据。新增回本月仅切换视图，不能修改记录。

## 历史页

独立 history-page 区域采用轻纸色画布、简洁大标题、清晰筛选条、两列插画记录卡（手机单列）。卡片一侧为标题与摘要，另一侧为本类别已有透明场景图，底部显示周期与原始状态；装饰不盖住正文。复用现有 TYPES、STATUS、formatDate、recordSummary 及已有日期标题规范化函数，所有记录内容 esc。插画映射为日 evidence/journal、周 recap、月 result、季 evidence、年 coordinate、决策 question 等本地资源；不联网分析正文，不新增持久字段或随机闪动。

继续调用 bindRecordOpen；现有搜索、类型和年月筛选、筛选后输入焦点、草稿/锁定记录打开保持。空态加入本地插画与原入口。长标题/长摘要须截取或折行，不压住状态和插画。主题色任意（包括白色）仍需可读，装饰 aria-hidden/pointer-inert。
