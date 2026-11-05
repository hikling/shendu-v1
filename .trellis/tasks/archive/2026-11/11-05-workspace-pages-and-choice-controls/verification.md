# 验收

基线 main：26185639d9385124284ecfe1f2bc048f3d456ced。

- 全量139/139项通过；build/check/资源烟测通过。
- 浏览器发现月历标题覆盖月份按钮，已在stage.css将导航置于标题上方；最终重建后相关18/18项、check和资源烟测通过，鼠标上/下月及键盘Enter切月实际验证成功。
- 每日状态鼠标、键盘空格与原字段同步；历史年份/月过滤正确；日历记录退出恢复原日期焦点；阶段必填、继续填写和放弃离开正常。
- 独立设置/日历/阶段/指南正常导航，无旧页面Dialog/遮罩；320/390/820px布局、成员/旧全白颜色/减少动态、空日历和失败保留通过。
- 截图、测量及具体边界见docs/page-choice-qa/README.md。使用本地合成数据，无真实账户/记录写入。全长截图接口不可用，保留实际视口证据和DOM测量。
- 独立审查报告research/independent-review.md，所报手机卡片旧flex覆盖已修复并重验。
- README/DESIGN/组件说明及5份前端规范已同步。

main功能提交：2c71b4ea33a3f3282aae5b811b5f09e8a2094b14。

GitHub Actions精确SHA检查：success，运行42002325411，https://github.com/hikling/shendu-v1/actions/runs/42002325411 。Linux构建、139项测试、Docker构建及容器资源烟测通过。验收记录之后仅有任务归档和日志提交，最终HEAD另行核对远程CI及本地/远程一致。
