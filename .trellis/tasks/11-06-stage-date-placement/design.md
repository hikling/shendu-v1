# 排查与改动边界

基线42ddba0。两次先前修复未在用户Chrome解决，证明仅分离按钮class和CSS改变table/tr/td显示不充分。首先检查原生table元素混合Grid和空格占位的失效机制；记录可复现的列位置故障，避免把具体用户绘制原因当成已知。

候选最小结构修复：只为阶段DayPicker覆写其提供的MonthGrid/Weekdays/Weekday/Weeks/Week/Day槽，以稳定模块级组件输出显式ARIA grid/rowgroup/row/columnheader/gridcell的div网格，去掉原生table匿名布局路径。每日期格按真实civil weekday显式指定列，避免依赖前置空白格撑位置。保留DayPicker日期与键盘/月份所有权、CalendarDayButton及验证日历不改。是否实施以研究和浏览器故障检查为准。

预期文件：ui/surfaces.jsx的阶段私有覆写与组件配置；ui/stage.css阶段单元格选择器；阶段相关测试；app.js/index仅缓存。规范和本任务验收随证据更新。禁止重新设计其他布局、其他页面或业务逻辑。
