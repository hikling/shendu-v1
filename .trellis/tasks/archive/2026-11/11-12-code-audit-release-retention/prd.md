# 安全与逻辑审查及发布整理

## Goal

审查应用安全与关键逻辑并修复可复现问题，验证后更新README，GitHub Releases仅保留最近四个已发布版本

## Requirements

- 审查生产代码的安全边界及关键逻辑，优先账户/权限/会话、记录生命周期、备份恢复/外部网络访问、异步UI和部署脚本。
- 对明确可复现且属于当前业务范围的问题修复并回归验证，不改页面设计或既定产品行为。
- 审查与验证后更新README，反映已实现功能、操作入口及真实维护边界。
- GitHub Releases按发布时间仅保留最近四个已发布版本，确认当前main部署包完整后再删除旧Release；保留Git提交和标签。
- 不操作线上数据库、真实账户、主密钥或第三方存储内容。

## Acceptance Criteria

- [x] 各层审查结论和明确问题/修复/剩余限制有记录。
- [x] 构建、相关与全量测试、依赖公告检查通过或如实报告阻塞。
- [x] README更新并同步main，当前部署包CI通过；Releases最终只有最新四个且核对资产。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
