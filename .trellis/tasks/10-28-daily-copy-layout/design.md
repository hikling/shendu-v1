# Boundary and implementation

问题归属：overview-type-grid在max1280改为repeat3grid，导致普通桌面宽度被切两行；引导逐字span无标点分句语义；gauge-title可见冗余；daily-current-group在正文progress而header保留每日复盘且<=1100隐藏label。

只改app.js对应每日模板/展示逻辑、styles.css对应断点/分句/分组和gauge-title死规则，index缓存overview22。不重写概览markup/逻辑/资产，不改数值计算和业务函数，不触碰其他五类。概览96px/84px尺寸沿用，三列布局下移到真正窄屏断点；桌面行空间不足时可在现有局部规则适当收gap，但不改其他视觉。

引导以保留标点的分句块承载原daily-glyph；同一span语义全文仍供读屏，动画glyph仍aria-hidden。每个逗号/句号后的下一字进入新块；完整几何预留不依赖动画progress。分句内允许窄屏自然换行，所有daily-glyph仍由既有计时器统一选取。桌面>=821px按最长分句的字符数计算纯数字列宽变量，利用copy容器的cqw限制字号，避免原大字把一个分句再次折成两行；<=820px保留原字号和自然折行。

移动daily-current-group唯一ID到daily-brand-label，writing显示真实分组，intro隐藏分组及分隔线，删除正文progress容器。断点不再隐藏有效header分组；小屏字体/间距局部收紧但不改header-brand/header-seal/header-wordmark规范值，避免再次改品牌。切换仍聚焦原题目/开始按钮并preventScroll，再滚动到daily-flow-head，防止移到header的分组被滚出屏幕；返回引导最后以nearest保证开始按钮可见。gauge-title整行删去，输入现有aria-label与for的组合label仍保留。

概览断点为<=700px三列、701—760px仅收紧gap至8px；961—1150px仅第一张介绍改向右侧展开并同步箭头/命中桥，防止恢复单排后卡片越过左边缘。其余介绍方向与交互不变。

验证只覆盖四项变化及受影响路径：桌面行数与图标状态、14条分句构造、intro到01/02/03/04/回intro、320/390布局、睡眠和精力可输入/保存/值保留/只读、减少动态。npmcheck、daily-flow10、独立fullscope check；文档与截图对齐。沿用会话已给的Trellis/提交推送授权，无需重复确认。
