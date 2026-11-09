# Boundary and contracts

public/backup-schedule.js共享配置校验、北京时间日历调度和计划描述；server.mjs拥有SQLite列迁移、API、备份恢复与调度；admin-cli.mjs快照元数据从数据库读取实际schema版本，避免新增迁移后仍标记旧版本；app.js沿用现有表单/组件桥接显示中文配置、具体日时与目标明确的十天运行记录；styles.css只改行动原计划局部布局，workspace-pages.css只改备份表格与计划字段适配。无框架或部署重构。

API target schedule保留manual/daily/weekly，新增scheduleTime HH:MM与scheduleWeekday 1(周一)..7(周日)；GET targets映射明确元数据。运行记录新增operation、目标名称/类型快照与手动/定时来源；测试结果只通过请求返回和通知展示，不改变备份成功日期。旧日志只迁移可确认的备份，无法区分的旧失败不伪造来源。

调度按Asia/Shanghai自然日/星期计算最近到期slot，不从上次手动/测试时间加24小时/7天。每分钟检查，重启只补最近一次到期；禁止执行目标创建/改计划前的slot；同slot已确认失败不重复，busy不消费slot。上传前用五分钟令牌租约占用，完成结果/日志/slot消费同事务；进程中断未完成的租约过期后可重试，旧令牌不能覆盖新占用。瞬时租约不导入整站恢复。迁移与整站备份/恢复保留新列，旧payload缺省兼容。

完成后局部/跨层测试，构建与全量回归，再按既有授权同步main并核对CI。浏览器可用时实测桌面/窄屏；不可用如实记录，不绕过宿主禁用。
