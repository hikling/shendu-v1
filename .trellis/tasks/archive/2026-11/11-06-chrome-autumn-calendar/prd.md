# Chrome每年十月十一月残留日期复现修复

## Goal

对比Chrome和Edge每年10/11月与前后月份，定位重复日期与异常空行，只修阶段日历并补连续切月回归，直接同步main。

## Requirements

- Chrome每一年的10月、11月出现额外日期与异常空行，Edge正常。截图2025-10多出11月2日，2025-11多处重复2/十三；对比9月和12月，不只检查当前2026年。
- 只修阶段日历；保留已确认的页头、年份/月份、图例、统计、等高侧栏及其他页面。
- 保留完整农历节气、原记录身份、禁用、选择、键盘、月份按钮焦点、退出复盘返回日期。

## Acceptance Criteria

- [x] 证据区分源码日期错误、切月残留和浏览器绘制差异；不再把未复现的根因当作已知。
- [x] 多年全年连续前后切月与9/10/11/12月对照，日期唯一且无外月可见残留、异常周行，Chrome及Edge、320px和桌面可用。
- [x] 对实际线上版本核查；构建、测试、独立检查及main同步通过。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.

## 完成验证

旧代码的实际组件回归在混合Date方法下失败（2025-09只有7个日期按钮，预期30）；Chrome旧构建另复现2025-11的31个日期按钮/30个唯一日期，10月外月日期和累计空行。stagecivil1修复后，153测试、脚本检查、UI smoke、792个Chrome/Edge月份/布局状态及原48项几何检查通过；独立复核5508个日期模型。具体My Fingerprint源码仍未访问，不将受控环境等同于插件源码。main/CI结果见docs/chrome-autumn-qa/README.md。
