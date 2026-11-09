# Boundary

仅修改前端入口、布局和相应测试/规范。server.mjs 的 owner/status/version 删除接口和旧保存防复活规则保持。dailyReviewHtml/extendedReviewHtml 在现有页脚中挂载同一规则的删除按钮，showDailyPrompt/showExtendedPrompt 负责仅末题显示，bindReview 绑定共享删除确认；锁定的旧草稿按 status 判断可删除，不按 locked 判断。

删除确认基于当前编辑记录，直接说明未保存内容也会丢弃，不先清除dirty。dialogWriteTask 保护忙状态，另外捕获当前编辑容器与记录身份，防页面/账户切换后处理旧响应。成功才清除dirty/current并返回历史，失败保留编辑状态。未保存记录不调用删除API。历史卡片恢复原标记，移除上一轮专属wrapper样式。

验证实际构建组件中的六类末页与确认行为、原后端测试、全量check/test和可用浏览器验收。无需数据迁移。
