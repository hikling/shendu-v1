# 阶段日期落列独立研究与检查

2026-11-06。源码只读，没有提交、业务写入或额外代理。

## 基线调查

冻结stagegrid1阶段的构建JS/CSS/app内容并在独立headless上下文复测，避免主会话后续build改变研究输入。内容SHA和完整几何见`native-probe.json`；脚本为`independent-native-probe.cjs`。

- Chrome156.0.8078.80和Edge156.0.4314.58正常空记录月历在1120/821/390/320px：全部30个日期的实际中心都与真实civil weekday列相符，11月1日只在周日，DOM只一个1。
- Edge强制`[data-hidden=true]{display:none!important}`后，11月1日从周日移到周一，但仍30个唯一日期、一个1。这证明节点总数和唯一性不能验证实际落列。主会话独立Chrome实验也复现此故障。
- 将原生tr的display改为table-row的注入变体，使两引擎25个日期落列错误，1移到周一；未产生两个1的重复绘制。
- 单独注入hidden visibility:collapse、原生table-cell或table-header/row-group，在此次实验中没有日期落列错误。

以上均为明确标注的注入故障，不证明用户环境实际采用了这些CSS，也未复现用户截图中的两个1/廿三。不能宣称已确定其具体浏览器环境根因。

## 实现检查

- 只有阶段Calendar使用模块级MonthGrid/Weekdays/Weekday/Weeks/Week/Day覆写。原生table/tr/td全部替换为div，并明确grid、rowgroup、row、columnheader、gridcell角色；组件私有day/modifiers/week和表格scope在spread前去除。
- StageDay按实际local civil日期计算gridColumnStart，后置覆盖styles，保留原DayPicker所有属性、children、disabled/状态/身份和按钮键盘处理。每周固定最小行高，完全空周不会塌陷。group/day类保留焦点工具样式。
- 全部结构覆写保持模块级稳定身份；按钮现有useCallback策略不改。共享CalendarDayButton与验证Calendar未修改，app/index仅更新所需缓存。
- 生产DOM回归覆盖七种月初星期、跨年和闰年，保留原记录身份、禁用、农历节气、六周42语义格和焦点行为。
- 已审阅`docs/stage-placement-qa/check.cjs`：验证真实x中心与weekday匹配，也验证civil week行索引和y包含关系；强制折叠占位格确实生效；空周仍有高度；月浏览保持焦点；使用隔离夹具只读替换记录响应，不写业务数据。其passed不等同在线登录页面验收。

## 独立验证

- npm run check通过；JavaScript包没有独立TypeScript/ESLint命令。
- 相关ui-surfaces生产构建回归9/9通过，git diff --check通过；QA脚本语法检查通过。
- 独立Edge156最终构建探针通过：1120/821/390/320px、普通及强制折叠外月占位格，所有日期实际落列正确、无原生table子树、六周有正高度；月份按钮焦点保持，跨年年份2027正确。见`final-edge-probe.cjs`与`final-edge-probe.json`。
- 主会话负责完整构建/测试与Chrome最终截图、线上资源和main/CI收尾。

## 非阻塞建议

- stage.css注释仍写semantic table/rows，应随实际div角色更新。
- 隐藏外月格会从可访问树中省略。完整日期按钮名已经包含星期，但为让div ARIA grid的坐标更明确，可在grid加aria-colcount=7，并让StageDay显式aria-colindex使用相同civil weekday值。该项不影响现有视觉落列，已向主会话提出；源码未擅改。

未发现新的视觉日期落列、交互或范围阻塞问题。

主会话收尾复核：两项建议均已落实；模块级StageMonthGrid明确aria-colcount=7，StageDay用同一civil column设置aria-colindex与gridColumnStart，生产DOM测试同步断言。注释已更正。最终构建后48组Chrome几何回归及151项全套测试通过。
