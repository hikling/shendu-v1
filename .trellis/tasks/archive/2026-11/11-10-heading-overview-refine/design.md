# Boundary

标题错位来自历史grid按大插画居中、行动按自身min-height居中。history-archive.css统一两个hero顶部padding、copy align-self:start、取消copy额外padding，并统一h1字号，插画保持各自布局。

historyArchiveArt仅改数字/单位HTML，保留计数来源和转义；history-ledger-count整行居中，篇为低字号基线单位，按位数略增数字，留出单位宽度。更新CSS/app版本。

概览styles.css拥有主句字号、入口间距和轮播margin；放大字体同时收紧hero/入口留白，让轮播实际向上而非因字号增大向下。保持弧线路径/缩放/焦点及减少动态效果，不改动轮播算法。

阶段设置删除showQuarter可见控件和读取，旧字段继续保留兼容但不控制六类入口。不修改后台规范化和备份版本。仅测试此行为的实际组件，视觉用隔离浏览器验收。
