# 完成提示跨栏修复

原因：为支持移除日记，先前把每日afterword放在daily-editor-content直属层，绕开daily-pane的桌面正文宽度和左右对齐，导致提示覆盖插画。

修复：根据当前模板的实际最后prompt，把唯一afterword放入其所属daily-pane。默认最后journal；关闭日记后最后verifyDate。其他五类保留原有正确结构。同步更新app入口缓存版本。

验证：npm run check通过；npm test生产构建及既有215项通过；新增review-completion-layout.test.mjs的3项通过（覆盖六类、三状态、默认/无日记及无普通问题，完整原值与导航保留）。git diff --check通过。

浏览器实测限制：宿主工具继续返回本地浏览器禁用；没有声称本次已经进行截图或窄屏视觉测量。结构回归证明提示位于现有自适应正文栏。

按此前授权继续同步main；不操作运行站点的个人记录或服务器数据。
