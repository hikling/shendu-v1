# 设计与边界

基线 main c7e2955。沿用用户已授权的连续UI开发、Trellis管理与main同步；本轮明确三项修正直接实现。

- 历史筛选在runtime按现有history-type/year/month的语义标识恢复原shadcn NativeSelect，撤掉该页RadioGroup布局覆盖，其他场景直接选项保持。
- 农历/节气在独立纯模块本地计算，采用已核实MIT的lunar-javascript 1.7.7；包锁定、许可和构建一起验证。Calendar保留原日期身份与DayPicker行为。stage.css将日期格改为完整双行日历笺，节气与农历低一级，状态独立标记；完整列格用明确table几何避免尾行日期溢出。只影响阶段日历，不改复盘verifyDate。
- 独立review-intros模块管理六个各不相同文案池和不重复抽取。以真实进入新record的访问上下文选择一次，回引导/保存/重绘沿用。app.js两类intro从同一访问文案读值。短句、长句与古典公版诗句混合，保留标点分行、全文可访问和打字机，按真实最长分句及行数调节可读字号。
- 三块所有权分离：history worker拥有runtime/choice-controls/history CSS及相关测试；calendar worker拥有surfaces/stage.css、lunar模块、package锁与日历测试；intro worker拥有app.js开场相关片段、review-intros模块、intro CSS及开场测试。主会话负责缓存、文档、集成和浏览器、最终质量与main。
- 无服务端/API/数据库变更，无外部内容服务，不全面重做历史卡片或概览。
