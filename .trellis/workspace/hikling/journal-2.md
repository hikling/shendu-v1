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


## Session 88: Finance ledger, lazy receipt gallery and expanded categories
<!-- trellis-session: v=2 fp=019ad84fcdaa202e -->

**Date**: 2026-11-17
**Task**: Finance ledger, lazy receipt gallery and expanded categories
**Branch**: `main`

### Summary

Removed ledger category filter and thumbnails; aligned action typography; contextual receipt gallery; expanded shared category inference with purpose-only legacy compatibility. Local full suite519passed/1optional skip, desktop1280/mobile390/320 accepted, GitHub six release jobs passed; retained four complete releases and all tags.

### Git Commits

| Hash | Message |
|------|---------|
| `fa5d071` | fix: refine finance ledger and automatic categories |
| `e850c44` | docs: record finance ledger release validation |

### Status

[OK] **Completed**


## Session 89: Mobile finance import, smarter categories and daily ledger
<!-- trellis-session: v=2 fp=6b5fbcd06bbf1ed7 -->

**Date**: 2026-11-17
**Task**: Mobile finance import, smarter categories and daily ledger
**Branch**: `main`

### Summary

Contained mobile import date fields; expanded classification; separate day/month ledger scope; bright rounded Chart/Pie and reduced-motion. Full suite524pass/1optional skip, actual1280/390/320 synthetic browser checks plus large total/motion accepted; physical Safari not tested. GitHub all six release jobs green; retained four releases and all tags.

### Git Commits

| Hash | Message |
|------|---------|
| `da8f1ea` | fix: improve mobile finance forms and daily ledger views |
| `70bfce9` | docs: record finance mobile and chart release validation |

### Status

[OK] **Completed**


## Session 90: Income entry and screenshot-matched expense recording
<!-- trellis-session: v=2 fp=a655403b8c3d7050 -->

**Date**: 2026-11-18
**Task**: Income entry and screenshot-matched expense recording
**Branch**: `main`

### Summary

Income-only creation preserves expense drafts; typed expense plans require stored receipts, unique amount auto-match and manual ambiguity resolution. Fixed Select popup overlay pointer issue; preserved legacy pictures/immutable uncertain retry payloads. Full suite538pass/1optional skip; final UI/matcher74pass; browser1280/390/320 accepted; GitHub six release jobs green; kept four complete Releases and all tags.

### Git Commits

| Hash | Message |
|------|---------|
| `13ef4a8` | feat: match expense receipts and separate income entry |
| `7ab84dd` | docs: record receipt matching release validation |

### Status

[OK] **Completed**


## Session 91: Simplify income, unify receipt upload and shrink phone reel
<!-- trellis-session: v=2 fp=29f3deddc17c5468 -->

**Date**: 2026-11-18
**Task**: Simplify income, unify receipt upload and shrink phone reel
**Branch**: `main`

### Summary

Income now shows date, amount, source and note only. One upload entry handles blank screenshot recognition and planned amount matching. Phone reel is 200x224 with long-title spacing; desktop unchanged. Local affected86 and full540 tests passed, handover13 passed; synthetic browser320/390/820/1280 verified. GitHub run44224159585 all6 jobs passed; latest4 Releases retained, tags preserved. Server deployment not performed.

### Git Commits

| Hash | Message |
|------|---------|
| `e7145be` | fix: simplify income entry and mobile record carousel |
| `8ed8335` | docs: record income and mobile reel release validation |

### Status

[OK] **Completed**
