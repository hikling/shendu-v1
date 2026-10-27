# Design / change boundary

行为差距在 app.js 的 dailyReviewHtml/showDailySection：当前按四节隐藏，节内仍显示所有问题。改为四节分组、节内单题，所有字段继续挂载以沿用 collectCurrent。只改 app.js、daily-flow.js、styles.css、入口缓存版本、必要验证测试；主代理维护文档与合成截图。不改服务器、数据结构、依赖、其他五类表单和概览。

## Question flow
- 01 sleep → energy → metric0/1/2（历史按实际指标数）→ risk；02 today → cause；03 action → ifCondition → ifThen → verifyDate；04 journal。一项指标的行动与完成选择属于同一个问题。原有today多条答案仍属于同一题。
- 在已有 dailySection 上增加当前问题标识；由确定性题序定义上一/下一题、题号、归属节和字段。内部重绘/首次保存编号变化保留题目与dirty，真实进入记录重置引导。
- 仅当前问题可见，其余hidden不进焦点；切换不卸载、不自动写。必填只验证today或当前action字段，最终完整验证可定位到具体问题；可选题可直接下一步。
- 写作时 app-shell 增加 daily 专用沉浸态：隐藏并inert顶部/关闭其菜单，workspace无头部占位；离开/回引导/shell重建清理状态。401重新登录仅覆盖原表单，保留当前题/输入/dirty/沉浸态，清理打字动画；真正替换为认证页时才清理布局。引导保留导航。写作的小型退出走 attemptNavigate，不绕过dirty和saving守卫。原锁定/只读/验证内容可达。

## Typewriter and visual
使用本地字体与现有主题：引导中文大字号（桌面约42—54px，手机28—34px）、舒适行长和留白、醒目但克制的按钮。逐字显现时按完整文本预留布局，避免部分文本换行跳动；完整语义文本供读屏，动画文本aria-hidden，不逐字aria-live。允许立刻开始，进入/离开时取消计时器；减少动态效果静态全文，无外部播放器。

每题以安静单列、明确题名与一处填写区呈现，保留简洁阶段/题号和前后操作。使用现有可读主题色与可见焦点；原原生数字/select/date控件保留。回滚前端提交即可，无数据迁移。
