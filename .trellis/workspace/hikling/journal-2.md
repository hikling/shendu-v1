# Journal - hikling (Part 2)

> Continuation from `journal-1.md` (archived at ~2000 lines)
> Started: 2026-11-17

---



## Session 86: 恢复手机菜单原宋体
<!-- trellis-session: v=2 fp=93f18b0a4cef833b -->

**Date**: 2026-11-17
**Task**: 恢复手机菜单原宋体
**Branch**: `main`

### Summary

撤回手机菜单黑体覆盖，标题和条目继承原宋体；保留字号布局、点击与箭头及桌面样式。构建、语法、18项菜单界面测试、独立级联审查和HTTP检查通过。GitHub main已推送且六个发布任务成功，Release保留最新四个并保留所有tags。未做手机浏览器实测或生产服务器更新。

### Git Commits

| Hash | Message |
|------|---------|
| `0df6572` | fix: restore original serif font in mobile navigation |
| `27961e9` | docs: record verified mobile serif restoration release |

### Status

[OK] **Completed**


## Session 87: 手机实载宋体、明细大字与截图按日归档
<!-- trellis-session: v=2 fp=4286dc3e20f58b7d -->

**Date**: 2026-11-17
**Task**: 手机实载宋体、明细大字与截图按日归档
**Branch**: `main`

### Summary

自托管101份Noto Serif SC WOFF2，手机标题菜单实际使用宋体，桌面字体保持；字体解码与HTTP完整性全部验证。放大明细并去重复算式；新S3/R2图片按北京时间每天平铺，兼容旧图与恢复。全量510通过1可选跳过，最终UI55和凭证27通过；真实浏览器320/390/1280验证字体与无溢出。GitHub六任务通过并生成双架构Release，仅保留最近四个版本及全部tags。未操作生产服务器或迁移旧桶对象。

### Git Commits

| Hash | Message |
|------|---------|
| `2c6bf7b` | fix: serve mobile Songti and organize receipt uploads by day |
| `a99f7cb` | docs: record mobile font and daily receipt release validation |

### Status

[OK] **Completed**
