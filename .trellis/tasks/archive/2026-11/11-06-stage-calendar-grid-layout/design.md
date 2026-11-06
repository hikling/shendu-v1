# 设计与边界

重复字形在上次本地未复现，不能把结构测试通过当作用户环境绘制正确。本次移除阶段日历的collapsed-table几何，保留真实shadcn/DayPicker节点及其键盘、月份状态，只对阶段Calendar应用明确的七列CSS Grid行、等宽单元格、空格不绘制内容。不得裁掉有效日期掩盖问题。

阶段Calendar拥有完整日历纸张内标题和图例，使用同一网格对齐。独立年份标注放在月历导航区域左侧，月份独占居中caption，前后箭头分列两侧；完整年月仍在可访问名称内。元件覆写身份稳定。

文件：ui/stage.css负责唯一阶段布局、统计尺寸、桌面等高与窄屏重排；ui/surfaces.jsx仅StageCalendar/StageCaptionLabel；public/app.js仅renderCalendar内部必要标记与bridge缓存版本；public/index.html仅对应资源缓存。tests/ui-surfaces.test.mjs更新阶段标题/年月结构回归。规范和本任务验收记录按需更新。不要改CalendarDayButton、验证日历、全局样式和其他页面。

桌面外层grid stretch，右列两行按内容合理分配并填满日历高度，当前阶段进度与底部动作自然贴底，待验证空态/列表占中间。两条行动长文适度截行只影响列表预览，完整行动仍可打开；不强行固定全页高度。手机自然垂直流。
