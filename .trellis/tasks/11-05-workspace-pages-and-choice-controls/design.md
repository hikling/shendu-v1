# 设计与边界

基线 main 2618563。用户已在连续UI迭代中明确授权实现与main同步，本轮直接实现所给两项修正。

- 原生select的浏览器展开层来自ui/runtime.jsx的NativeSelect适配。改为直接可见的单选项组，真实shadcn组件与原select的id/name/value/FormData/change/disabled/required兼容，键盘焦点可用；包括每日指标、历史筛选、决策验证、备份方式/目标及账户角色。较多选项自然换行、无文档横向溢出。不只修截图的一个字段。
- 设置、阶段与日历改为settings/calendar内存路由，走原attemptNavigate/dirty/saving保护及公共头部。用与账户/历史一致的暖纸背景、1480px内容边界、宋体标题及相关本地插画。
- 设置页面保留motion保存、账户导航、阶段配置与使用指南入口。阶段配置可在同页切换为编辑子视图，保留所有原表单和字段、保存/取消/未保存保护，不再用居中大Dialog承载设置导航。阶段与日历页面保留真实Calendar、当前阶段/待验证、共享统计与全部跳转。
- 删除设置与日历的旧overlay挂载路径；确认/验证/备份等功能性Dialog仍保留，Radix继续拥有其焦点/关闭，不全面改写认证或路由架构。
- 不改服务端、记录格式、验证等待期、六类已确认画布/概览布局和插画资源。局部重构通过原DOM/领域测试及新增导航/选择行为测试证明兼容。

责任：选择控件子代理拥有ui/runtime.jsx、组件/对应CSS与选择测试；页面子代理拥有app.js、ui/surfaces.jsx中阶段surface、stage.css、workspace-pages.css与页面测试。主会话拥有index缓存、文档、整合/浏览器QA、main与CI。共享文件变更需提前沟通。
