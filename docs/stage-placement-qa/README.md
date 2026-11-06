# 阶段日历日期定位验收

2026-11-06，仅修阶段日历结构和日期定位。保留现有年月标题、图例、统计与等高右栏；没有修改其他页面、记录字段、保存接口或共享验证日历。

## 修复与证据边界

阶段页为 DayPicker 提供稳定的 div 网格槽，去掉原生表格元素与 Grid 行混合布局。每格按真实公历星期指定列，ARIA 列号同步；空周保留高度。DayPicker 继续管理月份、禁用、键盘和焦点。

用户截图中的两个“1／廿三”未在本地 Chrome/Edge 普通基线复现，不能声称已确认该重复绘制的触发条件。已复现的独立问题是：旧版隐藏月外空白格后，1日移到周一，但30个日期仍唯一、只有一个“1”。新版同样注入下1日保持周日，所有日期的列与周行正确。未用隐藏/裁剪真实日期掩盖问题。

通过代理下载的 [cokee.cc.cd](https://cokee.cc.cd/) 公开 HTML/JS/CSS 为 `1.0.0-stagegrid1`；没有发现旧版本缓存的证据。下载资源在本地隔离环境复测得到相同注入失败，[资源哈希与结果](frozen-production.json) 可核查。网站直接浏览连接超时，**这不等于完成真实线上账户的视觉验收**。修复资源版本为 `1.0.0-stagegrid2`。

## 验证

- Google Chrome156：48组检查，包括320/390/820/821/960/1100/1120/1280px、2026年1月至2028年3月、空/有记录、跨年与闰年、占位格实际display:none、六个正高度周行、月份按钮焦点、退出记录返回原日期、减少动效。
- 每个日期的实际横坐标与独立计算的星期表头中心对齐，实际纵坐标位于正确周行内；不只统计节点数量。[检查结果](final-checks.json)。
- 独立 Chrome 配置的真实页面缩放80/100/110/125/150%，`body zoom`保持1；日期1唯一且在周日，无横向溢出。[页面缩放结果](chrome-page-zoom.json)。常规48组中的CSS zoom是额外日期定位压力测试，不用于代替浏览器页面缩放的响应式验证。
- 独立 Edge156复核正常与隐藏占位条件，1120/821/390/320px日期列正确、空周高度与跨年焦点保留；详细证据在对应Trellis任务research中。
- 本地 build、check、151项测试、资源/健康烟测通过；独立代码审查包含ARIA槽、原始记录身份、禁用规则和共享验证日历边界。

使用隔离合成账户及只读测试响应，没有修改真实账户/记录，未打开或改动用户 Chrome 配置。

## 复跑日期位置检查

`check.cjs` 需要可用 Playwright 和 Chrome，以及已登录的隔离合成服务（至少有一条每日记录）。请勿对真实账户服务运行。脚本固定浏览器时间，替换读取响应，不保存或验证记录。

```powershell
# 如 Playwright 未在 Node 默认路径中，指定其模块目录。
$env:PLAYWRIGHT_MODULE = '绝对路径/node_modules/playwright'
$env:CHROME_EXECUTABLE_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node docs/stage-placement-qa/check.cjs http://127.0.0.1:3192
```

## 截图

[桌面日历](fixed-1120.png) · [手机日历](fixed-390.png) · [移除空白格后的正确位置](fixed-collapsed-blank-cells.png) · [保留的整体布局](fixed-layout.png)

旧版对照：[正常](frozen-production-normal.png) · [注入隐藏空白格后错位](frozen-production-hidden-cells.png)。这两张是下载公开资源后的本地渲染，并非线上账户截图。

功能提交 `4c745f1f8b5384ec401f026246b6189bb353ce6b` 已推送main，对应 [GitHub Actions42152530590](https://github.com/hikling/shendu-v1/actions/runs/42152530590) 成功，包含Linux检查、151项测试、Docker构建及启动/静态资源烟测。隔离3192/3193服务已停止。

提交后再次读取网站公开HTML，仍加载`stagegrid1`。本次没有服务器部署凭据，也未执行线上部署；需按仓库README的更新流程重建应用后才能加载`stagegrid2`。刷新页面不能代替部署。
