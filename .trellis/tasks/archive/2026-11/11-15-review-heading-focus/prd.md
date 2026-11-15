# 复盘标题聚焦边框

## Goal
六类复盘通过按钮或滚轮切题后，标题不出现矩形焦点框。

## Boundary
`showDailyPrompt`和`showExtendedPrompt`在切题后将焦点移到tabindex=-1的静态标题；该标题继承`.daily-art-flow :focus-visible`通用轮廓。仅为此非交互标题覆盖outline，不改变切题、焦点、读屏、校验及交互控件的可见焦点。

## Acceptance
- 标题聚焦时无矩形outline；真实按钮、输入和验证错误样式保留。
- 按钮和滚轮仍使用原有过渡、焦点和输入保留机制。
- 语法检查与现有六类切题行为回归通过；浏览器不可用时如实记录。
