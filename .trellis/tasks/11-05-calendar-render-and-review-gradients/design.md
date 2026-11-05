# 边界与设计

基线main 1d15a7f，干净工作树。本轮沿用持续开发和main同步授权。

- 行为差距：真实截图出现额外1，前轮空外月DOM断言未覆盖实际绘制。需要先复现并比较DOM/CSS/重绘，修复真正的日历渲染/布局所有者，不能只遮住溢出。
- 日历由ui/surfaces.jsx、ui/stage.css与ui/components/ui/calendar.jsx负责；日期自定义组件不改变业务规则。若共用CalendarDayButton的语义类名造成表格匿名盒则在组件源修正，并回归验证日历。
- 图例置于日历顶部右侧，必要时手机独立一行；月份导航采用居中标题、两侧箭头，保留DayPicker焦点所有权与命中。
- public/styles.css中的daily-art-flow拥有六类全屏背景。复用daily-white/daily-paper构造静态浅到类别色渐变，原终点颜色与类别变量不改。intro和editor继承同一层，避免切题接缝。
- 修改范围预计：日历源和样式/相关DOM测试；背景CSS；缓存入口；文档/规范/验收证据。无API/数据库/概览或其他页面重做。
- 所有权：实现子代理负责日历/相关测试和research报告；主线程负责背景、集成、浏览器、文档及main。共享库更改需验证两个日历。
