# Change boundary

共享public/review-schema.js规范化questions与disabledFields；缺省questions由旧标题键迁移，显式空数组表示无普通问题。自定义ID使用custom_前缀。app.js继续拥有表单和路由，daily-flow/extended-flow使用配置遍历并校验，server使用同一结构验证完成与保存快照。指标允许0–12项。已完成或过期只读记录保留旧快照。答案不因配置移除而擦除。
styles.css单一高度变量控制六类textarea，移除按内容伸高，每日叙述input改为textarea。完成后使用已有data-nav导航。
不重做框架、概览、插画或部署，不改变加密、验证等待期与权限。
