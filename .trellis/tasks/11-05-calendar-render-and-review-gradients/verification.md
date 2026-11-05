# 验收

基线main 1d15a7f，2026-11-05。

- 修复日期按钮与td的类名冲突，表格格子CSS限定td；图例右上，月份与年份居中夹在左右箭头间。
- 完整build/check/150项测试通过，资源烟测通过，独立审查无新增缺陷、界面回归8/8通过。
- 空月历320/390/820/1000/1100/1280px及有记录月历验收；切月、跨年、重入、焦点与日期身份正常，新构建截图无重复字形。旧版用户绘制问题未在本地同样复现，保留调查边界而不声称确定具体环境根因。
- 六类intro/editor计算背景一致，从daily-white到原daily-paper静态渐变；桌面及真实390px检查无横向溢出，插画、标题与输入可读。
- 共享验证日历保留原选中2026-11-04和历史锁定，日历记录退出返回原日期焦点。无真实账户/数据修改。
- README/DESIGN/组件说明、frontend规范及break-loop分析已同步，docs/calendar-gradient-qa包含实际截图、计算值和控制台结果（无error/warn）。

功能提交 `443189a4e3882735deae55216c50e3f885e58d08` 已同步 main；精确 SHA 的 GitHub Actions [42024625579](https://github.com/hikling/shendu-v1/actions/runs/42024625579) 结论为 success（Linux 构建、检查、测试与 Docker/资源烟测）。验收记录单独提交后进行 Trellis 归档和日志记录，最终同步再核对 HEAD 与远端及 CI。
