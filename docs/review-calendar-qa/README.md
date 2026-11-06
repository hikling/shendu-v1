# 六类验证日历与阶段宽度验收

本次只修复共用验证日历的日期运算／翻月命中，以及阶段日历宽度。使用隔离合成夹具，无真实账户资料；浏览器检查仅允许GET请求。

## 复现与修复

旧构建在不一致本地Date API模拟下生成第一周8个单元格，并出现错误月份、重复星期标题。`baseline.json` 和 `before-verification-hostile.png` 保留了复现。验证日历原先仍使用原生本地Date，阶段日历已使用隔离的民用日期实现。

两类日历现在共用 `ui/calendar-date.js`：输入、选中值、实际今天、月份上下限和返回最早日期都保持YYYY-MM-DD的民用日期含义。验证日历继续使用真正shadcn/DayPicker表格和原生日期字段，阶段保留自身网格。月份导航局部提高层级，实际点击不再被标题挡住。没有更改服务器等待期、保存值、记录或六类插画。

## 验收结果

- `npm test`：构建成功，155/155通过；新增回归在修复前构建上明确失败。
- `npm run check`、资源smoke、`git diff --check`通过。
- Chrome157.0.8103.38：正常环境及offset-only、local-getters、partial-setters三类模拟；Edge156.0.4314.58：正常与partial-setters。生产模块加载前注入测试模拟，不宣称检查过My Fingerprint的私有实现。
- 257项浏览器检查：2025年9月至2028年2月连续30个月，每天文字／唯一日期／实际星期列和周行／框内位置正确，始终六周七列。真实鼠标翻月保持原导航节点与焦点，翻月不选择日期。
- 六类最早日期使用原 `verificationMinimum`，检查空值、早于最早日期禁用、返回最早日期和单次hidden-input事件。已锁定2024闰日历史只读，忙碌状态不接受选择；820/390/320px与减少动态效果通过。控制台及页面错误为零。
- 阶段日历在1920px实测卡片763.59→620px、内部600→540px；1440px卡片747.95→620px。1280px卡片612.36px、内部540px；390px仍保持原有358px卡片／324px内部，避免压缩手机内容。
- 阶段布局检查1920/1660/1440/1280/1100/1050/960/821/820/390/320px，桌面右侧上下两面板整体与日历同高，窄屏无横向溢出。农历、节气、字号和日期行高保留。
- 实际应用集成另通过12条流程：Chrome正常1280px、partial-setters390px各自覆盖六类历史入口→逐题查看→验证日期→退出。原hidden input与原记录verifyDate完全一致，选中日期唯一，锁定控制均禁用，input事件为0，退出回到原历史集合，无控制台／页面错误。

`after-*` 是修复后截图；`final-checks.json`保存测量和状态。实际应用历史入口的六类回归另见`actual-flows.cjs`及其结果。

## 复查

准备已登录的隔离合成测试站点、Chrome、Edge及Playwright；不要指向真实生产账户。

```powershell
$env:PLAYWRIGHT_MODULE='你的Playwright模块绝对路径'
$env:CHROME_EXECUTABLE_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:EDGE_EXECUTABLE_PATH='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node docs/review-calendar-qa/check.cjs http://127.0.0.1:3192
```

脚本直接挂载实际构建的共用Calendar验证日期与几何，再通过真实导航打开阶段页面检查宽度。截图临时隐藏固定顶部导航以避免长组件截图中途被遮挡；几何与鼠标检查不隐藏导航。
