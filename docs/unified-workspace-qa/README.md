# 六类文字、统一画布与账户整合验收

日期：2026-11-05。使用隔离的合成记录、超级管理员与普通成员页面验收，不接触实际账户或数据库。

## 结果

- 六类背面分为两行，宋体大字：1280px屏幕26.88px，320px屏幕21.12px。原位翻面、独立散开、单按钮导航和类别配色保留。普通减少动态偏好下无粒子/旋转，键盘聚焦仍立即显示两行名称。
- 六类复盘的顶部、引导和正文与历史/行动共用1480px外框及相同左右留白。1920px屏幕的实际内容宽1352px；字体/插画尺寸仍有上限。完整测量见 [geometry.json](geometry.json)。
- 六类均检查320/390/820px，共18组，无内容横向越界；正文保留16px左右留白。见 [narrow-geometry.json](narrow-geometry.json)。
- 历史、备份、账户外壳及设置Dialog使用行动验证的同一暖纸底色：rgb(248,245,238)，叠加左上白色、右上暖灰径向渐变。实际计算样式和截图确认覆盖成功，各功能面板/六类艺术画布仍保留自己的配色。
- 桌面、手机和设置均只有一个账户管理入口。所有角色可查看身份、更新自己的密码、安全退出；超级管理员另外显示成员管理。普通成员页面不显示成员工具；不请求管理接口由实际DOM测试确认。
- 账户页面检查1280/820/320px。设置进入账户管理后Dialog关闭，页面可交互；原密码required、autocomplete、15—128字符新密码约束保留。管理员列表合成503后通过本地重试恢复，个人安全区域保持原位。

## 截图

| 检查 | 实际截图 |
| --- | --- |
| 概览两行背面 | [1280px](overview-two-lines.png)、[320px减少动态/键盘焦点](overview-reduced-320.png) |
| 统一复盘边界 | [每日1920px](daily-1920.png)、[每日320px](daily-320.png) |
| 暖纸工作区 | [历史](history-1280.png)、[数据备份](backup-1280.png)、[设置](settings-1280.png) |
| 管理员账户整合 | [1280px](account-admin-1280.png)、[820px](account-admin-820.png)、[320px](account-admin-320.png) |
| 普通成员账户 | [1280px](account-member-1280.png)、[820px](account-member-820.png)、[320px](account-member-320.png) |

## 检查与边界

- `npm run check`、构建、全部128项测试通过；`npm run smoke:ui -- http://127.0.0.1:3192`通过健康、HTML、应用模块和本地shadcn JS/CSS烟测。
- 新增7项账户实际DOM测试，覆盖角色权限、表单保留、过期请求、密码/退出pending、失败与所有者归属、设置导航。独立审查另跑18项相关测试并通过，未发现代码缺陷。
- 浏览器控制台最终无error/warn；临时viewport、标签和3192—3196隔离服务均已清理。
- 浏览器没有填写或提交密码，没有执行账户/备份写操作；相关成功、失败、重复提交与旧所有者路径由合成DOM测试验证。本次不改变服务端、数据库、接口字段、依赖或插画资产。
- [Trellis验收和CI记录](../../.trellis/tasks/archive/2026-11/11-05-unified-workspace-and-account/verification.md)。
- 功能提交`00bd4d25a7880f9ff8b73c2a1444bb30f60aa501`已同步main，[Linux CI #41993966584](https://github.com/hikling/shendu-v1/actions/runs/41993966584)成功，含Docker构建与启动烟测。验收文档/归档后的最终提交另行核对CI。
