# Bug Analysis: 时区插件下的秋季日历

## 1. Root Cause Category

E（隐含假设）与D（环境覆盖缺失）：DayPicker/date-fns 默认本地 Date 的构造、getter、setter 和时区偏移一致。受控混合改写打破这一假设，导致重复民用日期、错误星期及 React 重复日期身份。用户插件具体源码尚未验证。

## 2. Why Fixes Failed

前次阶段 div grid 和显式星期列解决的是占位格折叠后的布局稳定性。它仍依赖被改写的 getDay 和日期迭代，不能修正错误日期模型。普通 Chrome/Edge 和标准 DST 均通过，因此只检查默认环境或节点数无法证明用户环境正确。研究中的 UTC timeZone/TZDate 仍会读取被改写的系统 offset，不能作为这类问题的替代修复。

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
| --- | --- | --- | --- |
| P0 | Architecture | 阶段私有 civil Date，DateLib 克隆／newDate／today保持同一字段语义 | DONE |
| P0 | Regression | 实际生产组件在混合API环境旧代码失败，新代码通过 | DONE |
| P0 | Browser | 先安装模拟再导入应用，连续跨年切月，验证每个日期位置／唯一性／焦点／记录返回 | DONE |
| P1 | Lunar | 纯日期校验与月底计算不依赖本地时区；原农历节气与Date输入语义保持 | DONE |
| P1 | Spec | component-islands.md记录专用适配、反例和证据边界 | DONE |

## 4. Systematic Expansion

共享验证日历也依赖本地 Date，但本次用户明确只修阶段与日历，没有修改该页面。既有验证日历测试仍通过。不要从此修复扩展为全局Date补丁，不改变业务时区或持久化格式。没有项目生成模板需要同步。

## 5. Knowledge Capture

component-islands.md 已写入可执行接口、模拟环境、错误／正确路径及断言；docs/chrome-autumn-qa保留前后截图、可运行脚本和完整结果。最终报告区分隔离环境验证、main/CI、实际线上资源和未取得源码的用户插件。
