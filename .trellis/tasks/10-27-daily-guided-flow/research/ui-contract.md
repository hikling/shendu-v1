# Canonical UI ownership

Audience: 自己使用的中文个人成长复盘工具，桌面/手机，Asia/Shanghai，无日本市场路由。

| Capability | Existing owner / decision |
| --- | --- |
| Route and departure | navigate / attemptNavigate，保持未保存离开确认 |
| Form data | collectCurrent / renderReviewFromCurrent；四步面板隐藏不卸载 |
| Required validation | validateCurrent 与服务器 complete；按同样字段分步检查 |
| Save/complete/error | saveCurrent / completeCurrent / request / toast，手动保存，无自动保存 |
| Templates/read-only | templatesForRecord / templateSnapshot / locked，与历史一致 |
| Confirm and stage/calendar | openModal / rightRail / setRailOverlayOpen；不另造第二弹框 |
| Stats | statsHtml / state.stats，移位并增加 rail 紧凑样式 |
| Tokens and motion | styles.css / applyTheme；六主题和两种减少动态效果设置 |

旧 architecture.md 中 dailySection 描述与当前代码不一致；以真实表单和本次用户需求为准，完成后同步文档。

验证使用隔离的真实 server.mjs 与一次性 SQLite 数据目录，全部合成内容；代理仅注入测试会话、一次性失败响应以验证重试，不使用用户运行数据。
