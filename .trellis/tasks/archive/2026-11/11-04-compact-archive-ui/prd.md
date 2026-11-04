# 紧凑日历与宽幅归档

## 已确认需求
- 删除顶部复盘入口。
- 阶段与日历重做，避免多区块纵向堆叠和常规视口内滚动。
- 历史复盘、行动验证加宽，统一行动详情展开布局。

## 实现边界
只改 app.js 的导航、日历视图切换和行动卡片展示，styles.css 对应布局，以及 index.html 缓存版本。保留正在进行的65张插画工作，不覆盖它的更改。记录/API/验证时间规则不变。

## 验收
- npm run check 通过；npm test 85/85；git diff --check 通过。
- 1280px实看：顶部不再有复盘；历史/行动宽幅展示。
- 390x740实看：历史无横向溢出；日历clientHeight与scrollHeight均601，没有面板纵向滚动。
- 当前阶段、待验证切换成功；关闭后恢复主页面。
- 截图 docs/calendar-compact.jpg、docs/history-wide.jpg。
- 极短视口保留overflow:auto作为可访问性兜底，避免控件被裁掉。
- 用户已批准与前序插画工作一并提交main。
