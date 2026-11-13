# Execution

1. 并行三个边界审查；根代理检查部署/依赖并取Releases库存。
2. 对确定问题复现、分配互不冲突修复和测试；整合后独立复查。
3. 全量check/build/test，README和安全记录更新，提交/main同步并确认CI发布。
4. 按最终published_at保留最新四个Release，删除旧项并重取列表验证；记录结果后提交验收文档、归档任务和记录日志，再同步main并核对最终CI。
