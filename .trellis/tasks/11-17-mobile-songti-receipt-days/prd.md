# 手机宋体、明细可读性与截图按日归档

## Goal

自托管手机宋体，放大收支明细并移除重复金额，新凭证按北京时间日期平铺存储并兼容旧索引

## Requirements

- 手机端标题实际使用宋体，在设备未安装宋体时也能正常加载。桌面维持原字体和排版。
- 收支明细放大用途、分类、日期、备注、金额与操作等文字；用途下不重复展示金额或算式，编辑时保留原数据。
- S3/R2 新截图按北京时间每天一个目录，日期目录内平铺图片和缩略图，取消每张截图的单独目录。
- 旧截图继续可查看，备份恢复继续兼容旧路径；不自动移动或删除已有外部对象。

## Acceptance Criteria

- [ ] 本地宋体文件真实存在、可由网站加载且覆盖常见中文标题，手机标题使用该字体。
- [ ] 收支明细更清楚且金额只在右侧显示，修改/退款/截图操作保持正常。
- [ ] 同一天的多张新截图在同一目录，跨北京时间午夜分目录，重试仍隔离旧上传授权。
- [ ] 新旧凭证均能校验、读取和备份恢复，账户隔离保持有效。
- [ ] 自动检查通过并同步 GitHub main，说明实际设备验收范围。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
