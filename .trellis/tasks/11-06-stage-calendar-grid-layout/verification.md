# 验收

2026-11-06，基线main382dc6f。

- 五处源码/测试更改限定阶段页：stage.css、StageCalendar/StageCaptionLabel、renderCalendar标题归属和必要缓存、index缓存、阶段界面回归。共享CalendarDayButton/DateCalendar和全局styles.css保持原样。
- 日期行七轨Grid、完整农历节气/状态/禁用/原记录行为；标题图例共网格、年份独立、月份居中；统计局部放大；两列桌面上下边界差0px。
- build/check/150项测试、本地UI资源烟测通过。真实Chrome空态/普通/长行动、1280/1100/960/820/390/320px、跨月跨年和焦点返回、CSS缩放复测通过，控制台无错误警告。
- 独立检查发现300字阶段focus导致溢出，已修复并独立复核1280/1100/960/850/821/820/390/320px：文本完整、进度条4px、底部不越界、桌面两列等高。无剩余审查发现。
- docs/stage-grid-qa记录真实截图、几何、检查和未复现边界。上次用户环境右缘重复绘制未在本地基线同样复现，不能声称确定具体绘制根因；本次更换阶段布局路径并验证新构建。
- 规范仅同步阶段页相关契约；无数据、接口、保存、权限或其他页面样式更改。

功能提交 `068a70c77200b5e1c62e1691ed43df4240634e3a` 已同步 main，对应 [GitHub Actions 42144408961](https://github.com/hikling/shendu-v1/actions/runs/42144408961) 已完成且 success，包含 Linux 构建、检查、测试及 Docker/资源烟测。隔离服务3192/3193已停止。验收记录、Trellis归档和日志随后独立提交，并在结束前检查最终远端SHA/CI与干净工作区。
