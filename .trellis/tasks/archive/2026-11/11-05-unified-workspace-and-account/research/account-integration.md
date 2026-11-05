# 账户管理整合实现报告

## 完成内容

- `shendu/public/app.js`：桌面和手机菜单只保留一个账户管理入口，对所有登录角色可见。设置中的账户入口先关闭 Dialog，再使用既有 `attemptNavigate` 保护进入 `users` 路由。
- 账户页内联当前身份、角色、个人密码修改、安全退出与相关静态本地插画。页头文案为“账户 · 安心记录”；管理员成员区保留“共管 · 权限有界”。删除旧 `openAccount` 弹窗与独立“账户与安全”入口。
- 管理员成员列表拆成 `loadManagedUsers` 独立区域。查询、创建、重置、删除、角色或状态更新只刷新成员区，不重建个人密码表单。普通成员不请求管理员列表接口。
- 异步列表以当前 DOM 所有者、账号对象和每次请求的 Symbol 共同确认有效性，过期请求不能覆盖新访问或新查询；失败在成员区提供本地重试。
- 密码/退出保留原始接口、原生字段名、必填/autocomplete/15–128字符约束和退出前 dirty 检查。增加提交单飞、pending 禁用与现有 `state.saving` 导航保护，失败保留字段供重试。过期完成不能初始化其他账号，也不能清除新写入所有者的保存状态。
- `shendu/public/workspace-pages.css`：账户身份/密码两栏，820px 以下堆叠，390px 以下优化身份插画与长文本；成员区域沿用既有自适应表格。

## 边界和权限

- 沿用 `/api/me/password`、`/api/auth/logout`、`/api/admin/users`、`/api/admin/registration`，未修改服务端或持久化结构。
- admin/superadmin 才挂载成员区；公开注册开关和角色调整仍限 superadmin；服务端继续作为权限权威。
- 个人密码提交/退出成功走原 `init()` 重新登录行为。无真实账号、凭据或数据写入；测试只用本地虚构 fixture。
- 新区域仍用 `renderMarkup` 清理/增强真实 shadcn 控件，保留 React islands 的所有权。

## 检查证据

2026-11-05，在 `shendu/` 运行：

- `npm run check`：通过。
- `node --test tests/account-workspace.test.mjs tests/settings-motion.test.mjs tests/ui-overlay-inert.test.mjs`：18/18 通过。新增账户测试7项，覆盖普通成员无管理员请求、表单节点/值保留、过期列表与重试、密码/退出单飞与重试、账号/写入所有者隔离、设置关闭后导航。
- 仓库根目录 `git diff --check`：通过，仅既有 LF/CRLF 提示。

## 交付与后续

- 子代理未运行浏览器、完整构建或全量测试，未 commit/push。
- 父会话负责完整 build/test、桌面/手机真实渲染、焦点/角色/弹窗状态验收、文档规范、main/CI 与 Trellis 收尾。
- 重点视觉检查：身份插画与长用户名在820/390/320px的边界，管理员成员区布局；个人表单在成员搜索后保留编辑内容。
