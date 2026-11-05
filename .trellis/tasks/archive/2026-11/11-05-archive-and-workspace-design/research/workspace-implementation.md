# 工具空间实现说明

## 文件与作用域
- `shendu/public/app.js`：`spacePageHead` 改为备份／账户管理专用插画页头；新增 `workspaceArt`、`workspaceDialogHead` 和静态场景映射。重排 `siteBackupSection`、`renderBackup`、`renderUsers` 以及 `openSettings`、`openAccount` 的呈现；主题／阶段／指南仅接入局部插画页头和类名。
- `shendu/public/workspace-pages.css`：独立页面与弹窗样式，纸白表面、宋体标题、细描边、绿色／紫色／琥珀／蓝色功能色、桌面图文分栏与手机重排。`workspace-dialog` 仍由原 Radix Dialog 管理，设置返回按钮和标题／描述查询保持有效。

## 保留的合同
- `bindBackup`、`bindUsers`、`openSettingsTarget` 的原逻辑未修改；备份／整站／用户创建删除保护与请求均保留。账户密码和退出事件与原行为相同，未执行任何真实写入。
- 原控制 ID 数量保留，包括备份密码／导出／恢复／整站／新增目标、搜索／注册／创建成员及密码／主题／阶段表单。
- 原表单字段、约束、autocomplete、禁用状态、角色判断、加密与归属提示保留。个人备份的技术说明收进原生 details，其内容仍可展开阅读。
- 所有新增动态描述通过 `esc()`；7 个场景键全部指向已存在、已审核的本地 WebP。插画为 aria-hidden、pointer-inert，不含新交互、外部请求或持久化字段。
- 标准 Dialog、异步 renderMarkup 和组件宿主机制未变。没有修改 overview、review、actions 或 stage/calendar 布局。

## 检查
- `npm run check`：通过。
- `git diff --check`：通过（仅已有换行格式提示）。
- 静态对照确认原关键控制 ID 数量、7 个插画路径及上述未修改行为块。
- 主会话负责集成生产构建／全量测试、真实浏览器桌面与窄屏、空数据／普通成员／错误状态、设置往返／白色主题与最终 main 同步。

## 操作弹窗补充
主会话确认后，仅在 `workspace-pages.css` 追加既有表单 ID 作用域样式：`backup-pass-form`、`restore-password-form`、`site-export-form`、`site-inspect-form`、`site-restore-form`、`target-form`、`delete-user-form`、`user-form`。统一这些弹窗的纸面、标题墨色与字重、输入边界、按钮和底部操作区；成员操作沿用绿色，备份操作沿用紫色。破坏性确认不加插画，其警示文本、字段、保护和处理逻辑均不变。选择器只匹配含上述表单的 modal，不作用于复盘、行动验证或阶段日历弹窗。
