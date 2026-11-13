# 复盘滚轮切题与滚动条优化

## Goal

统一轻量滚动条，为六类复盘增加带阻尼的滚轮逐题导航，并在账户设置中持久保存开关。

## Requirements

- 全局滚动条统一轻量样式，保持可见、可拖动，悬停/拖动及高对比度模式可用。
- 六类复盘向下滚轮下一题、向上上一题；一次连续手势最多切一题，有阈值、冷却和安静间隔，防触控板惯性连跳。
- 沿用原有校验、输入收集、只读与保存中保护；不从引导页自动进入，不自动提交/锁定。
- 输入框和页面有内容可滚时优先滚内容，同一手势到边缘不顺带切题；弹窗、横滚和缩放不切题。
- 设置新增「滚轮切换题目」，默认开启，关闭恢复普通滚动；按账户保存，与减少动态独立，备份恢复保留。
- 保留原按钮、键盘和触屏导航，桌面和窄屏可用。

## Acceptance Criteria

- [x] 六类切题、阻尼、内容滚动优先、校验/busy/弹窗等边界有行为测试。
- [x] 偏好保存、失败重试、陈旧请求与后端持久化/备份兼容验证通过。
- [x] 构建、341项应用测试及13项交接包测试通过，设置桌面保存与刷新已验证。浏览器重新连接不可用后，用户明确选择先完成代码和自动检查；滚轮手感、滚动条完整视觉及窄屏实测不作为本轮交付门槛，见verification.md。
- [x] 同步main并核对GitHub构建发布，工作提交8c4884c、运行43427303768全部通过。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
