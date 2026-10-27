# 每日复盘分步填写与日历统计

## Goal

按用户明确要求，将每日复盘改为居中引导和依次填写四步，把三项统计移入阶段与日历。

## Requirements

- 用户已明确授权开始修改并要求继续。首屏仅居中一段引导文字与开始/继续/查看复盘按钮。
- 01 今日证据、02 事实与原因、03 明日行动、04 日记各自独立显示，下一步依次进入，支持返回修改，保留值和脏状态。
- 沿用已有字段、模板、可选/必填规则、手动保存、完成锁定与历史只读规则。不强制填写可选日记或证据。
- 本周每日复盘、等待验证、累计完成复盘只在阶段与日历弹框显示，仍可进入对应页面。
- 其他五类复盘仅移除共用统计，不改表单与业务逻辑。概览轮播不变。

## Acceptance Criteria

- [x] 草稿首屏安静，开始后同一时刻仅一节可见；前进/返回、增删条目后内容保留。
- [x] 保存失败可重试，成功不跳首屏；未保存离开有提醒；完成前原规则仍生效。
- [x] 历史和锁定复盘可分步查阅，原验证结果和待验证入口可访问。
- [x] 日历统计真实紧凑，支持键盘、窄屏与主题；统计导航先关闭父弹框再执行离开保护。
- [x] 检查、测试和浏览器验证通过，更新 README、设计规范与合成截图。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
