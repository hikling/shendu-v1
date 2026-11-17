# 整理收支明细与截图查看

## Goal

用途与类型分类胶囊同行、底部统一操作、取消缩略图、截图弹窗显示账目用途金额日期

## Requirements

- 修改、登记退款、删除与查看截图文字同样大，放在明细底部对齐。
- 用途作为更大的主标题，收入/支出和分类分别使用胶囊标签，优先同行排列，窄屏安全换行。
- 列表只显示查看截图入口，不展示或预加载缩略图；点开才加载图片，多张截图仍可逐张查看。
- 截图弹窗展示对应账目的用途/类目、金额、日期，移除“账目截图”标题与插画。
- 保留现有宋体、金额数据、操作、截图授权和错误重试行为。
- 去掉收支明细中的“账目分类／全部分类”筛选框，保留用途搜索与收支类型。
- 扩大自动分类词库，买菜归餐饮、买东西归购物，覆盖更多生活消费语句；具体用途优先于泛购物词，未知用途仍直接作为分类，手动指定分类保持有效。

## Acceptance Criteria

- [x] 明细主标题和胶囊清晰，底部文字大小与对齐一致，320px无横向溢出。
- [x] 列表无缩略图和提前图片读取，查看截图后才请求当前图片。
- [x] 弹窗上下文与点击账目一致且无插画，多图导航与重试正常。
- [x] 现有相关测试、构建、检查通过，浏览器桌面与手机尺寸验收。
- [x] 同步GitHub main并验证发布状态。
- [x] 无账目分类筛选框；逐行录入、详细录入、截图识别与服务端自动分类结果一致，已有账目不被批量重写。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
