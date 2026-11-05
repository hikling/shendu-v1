# 源码与验收基线

- `historyCardHtml` 原生 button 经过真实 shadcn Button 增强；组件的居中对齐可影响未指定宽度的 span。应修正历史卡片自己的布局合同，不能修改全部 Button 默认行为来补救。
- `renderHistory` 的局部投影持有 q/type/year/month，搜索 rerender 恢复 caret；配图分配在过滤前接收完整 state.records。记录入口保留 data-open-record 原ID与 bindRecordOpen。
- `spacePageHead` 当前只用于 backup/users。可将其替换为这两个工具页共用的插画页头；不必引入路由、React整页重写或额外库。
- `renderBackup` 异步加载后用 renderMarkup 更新 #backup-content，再 bindBackup。保留个人密码/导出/文件input、整站角色保护、目标编辑/测试/执行/删除、最近运行记录；失败状态必须可读。
- `renderUsers` 保留 #users-content、#user-search change、registration-open 原超级管理员条件、所有 data-user-* 以及禁止管理自身/超级管理员的条件。装饰不能成为权限判断来源。
- `openSettingsTarget` 依赖 .modal-head 安装返回设置按钮；openModal 读取 .modal-head h2/p 生成 Radix 名称与说明。账户、设置与子弹窗仍用原 openModal，不另设键盘或焦点循环。
- 复用隔离 QA 服务器 `shendu/tmp/shadcn-qa-resume.mjs`：3192认证代理/3193后端，数据库位于已存在的 `shendu/tmp/history-actions-ui-1793789145925/`；actions_preview 是合成超级管理员，包含六类草稿及已完成/验证记录。不要重新播种或指向生产data。
- 本任务不提交临时脚本、数据库、密钥或构建产物。页面验收只查看/输入可取消设置；不提交密码、恢复、注册权限、删除和外部网络备份操作。
