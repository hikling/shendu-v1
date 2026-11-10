# Boundary

server.mjs 新增个人操作事件表（FK user cascade）、成功操作事件写入、按北京时间日期查询/游标分页；事件字段为固定枚举和必要记录类型/周期/存储类型，不承载正文或凭据。正常写入和日志应具备一致结果，沿用SQLite事务；不对读取和测试连接记录。整站导出恢复需保留新日志，兼容旧payload没有该字段；CLI快照自动包含新增表。日志不设自动清理，分页限制单次读取量。

API GET /api/activity?date=YYYY-MM-DD&cursor=<last event id> 返回 {date,entries,nextCursor}，entries字段 {id,action,recordType,period,targetKind,createdAt}。固定每页50条，降序(created_at,id)，cursor必须属于本人和所选日期，错误返回400/404，不泄露其他账户。action固定为 login/logout/draft_saved/draft_deleted/review_completed/action_verified/stage_updated/preferences_updated/backup_success/backup_failed/backup_target_created/backup_target_updated/backup_target_deleted/data_exported/data_imported/site_exported/site_imported/password_updated/backup_password_updated。个人和整站导出记录文件生成成功，不宣称浏览器已收到下载。

app.js settings新增activity入口，普通workspace activity页面：日期输入及前一天/后一天/今天、每日结果列表及加载更多，只读，无新增日志API。今天由现有北京时间today()，原生date控件沿用设置既有日期输入契约；查询页/账户/日期变化后忽略旧响应，保留控件节点。workspace-pages.css拥有日志与设置三卡布局；history-archive.css拥有页头与分区线调整。三处分区的线改为标题行伪元素，不由整块说明宽度决定。index资源版本更新。

不改六类复盘输入/验证日期规则、账户权限、真实运行配置或用户记录。隔离HTTP/实际组件测试及浏览器可用时的桌面/手机验收。
