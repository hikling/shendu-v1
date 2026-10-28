# 每日复盘蓝墨艺术视觉重构

## Goal

根据用户明确要求突破原框架，重做每日复盘为具有强烈艺术感的蓝墨光场、巨幅汉字和场景化逐题体验。

## Requirements

- 根据用户明确反馈，突破旧框架重做每日复盘视觉，强艺术感和鲜明构图，而不是放大字号或换一层浅色卡片。
- 引导大字、打字机与单题填写继续可用；睡眠、精力、指标、事实/原因、行动字段和日记保持单题。
- 引导与填写采用完整艺术画布、蓝墨光场和场景汉字；导航可以重设，但需清晰退出和恢复其他页面。
- 保存、dirty提醒、忙碌/失败、401恢复、只读/模板快照/验证入口不变；其他五类和概览不重做。
- 桌面与手机都可用，装饰不阻挡输入、按钮、焦点；保持主题可读和两种减少动态效果。

## Acceptance Criteria

- [x] 引导及至少睡眠/精力/文字题有明显区别于旧版的完整艺术画面，真实截图自评。
- [x] 每屏只有一题，所有输入及前后切换、增删、保存/失败重试保留状态。
- [x] 退出后其他页面导航正常，历史/完成/验证数据规则不改变。
- [x] 窄屏无横向溢出，错误/聚焦/减少动态效果/浅色主题可读且可操作。
- [x] 适当检查和测试通过，README/设计规范/截图同步，提交并推送。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
