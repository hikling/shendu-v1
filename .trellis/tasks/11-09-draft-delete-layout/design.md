# Boundary

server.mjs 新增 DELETE /api/records/:id，先读取请求体重新确认会话，再按 owner/status/version 条件删除。仅 status=draft 可删，past-period 不限制删除，已提交返回 locked，过期版本返回 version_conflict，不暴露他人记录。PUT 携带已不存在的 ID 返回 record_not_found，防止其他设备的旧保存请求重新创建已删除草稿；新建仍不携带 ID。无需数据库迁移。

app.js 的历史卡片增加与打开按钮平级的草稿删除控件（不能嵌套 button），通过现有确认框与 owner/pending 保护执行请求；复用当前筛选与请求助手。应用非复盘页面的装饰短句直接从生成标记移除。六类复盘不变。

ui/stage.css 是实际右栏布局拥有者，改为阶段自然高度、待验证填充余量；ui/surfaces.jsx 移除日历内部装饰短句并调整标题/图例排列。history-archive.css 为历史卡片草稿操作布局适配。接口/组件行为测试覆盖删除、拒绝、失败/并发/账户切换；浏览器验收桌面与手机。
