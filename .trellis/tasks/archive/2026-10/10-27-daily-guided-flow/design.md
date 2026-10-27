# Technical design

## Change boundary
renderReview 当前同时输出四节 daily 表单和 statsHtml。实际行为归属 app.js 渲染/收集/保存路径。修改 app.js、styles.css、index.html；必要时增加纯 daily-flow.js、规则测试与 package check。主代理负责文档和截图。不改 API/数据库/依赖/框架。

## Daily lifecycle
- 真正进入 daily 先引导；内部增删条目重绘保留步骤与 dirty。引导沿用 quoteFor 段落。
- 四个 pane 保留 DOM，只切换 hidden；collectCurrent 沿用字段选择器。引导与写作区切换不销毁输入。
- 显示当前步骤/总步数；单节收敛宽度；底部上一项/下一步；各步可手动存草稿，最后一步才显示完成。
- 01 证据和04日记原本可选；02要求至少一条 today；03行动、阻碍、应对、验证日期沿用校验。失败聚焦字段并提示；最终校验发现隐藏步缺项需回到那步。
- 历史/完成/验证沿用 locked，最后一步展示原验证结果/待验证入口。内部重绘不覆盖旧模板快照。
- 不新增自动保存。保存/完成失败保留数据步骤，沿用 attemptNavigate 和 sessionExpired。

## Stage/calendar
statsHtml 仅在 rightRail 调用一次，以紧凑样式跨列呈现。调整既有 stage/calendar/pending 网格行，移动端重排。统计导航关闭 rail 再经 attemptNavigate。真实数据源与模板不复制。

## Compatibility
其他五类表单与概览不变，DOM id唯一，支持六主题与 reduceMotion、标签/焦点/忙碌状态。更新静态资源版本。回滚前端提交即可，无数据迁移。
