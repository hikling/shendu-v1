# 设计边界

验证日历实际由ui/surfaces.jsx的DateCalendar与shadcn/DayPicker实现。阶段日历此前已使用隔离民用日期实例规避扩展篡改本地Date接口；本次核实并让验证日历在自身日期运算入口复用这一机制，保持YYYY-MM-DD含义和DayPicker单一键盘／焦点所有权。必要时给验证日历增加局部几何修正，依据真实绘制位置确认，不能裁掉合法日期。

阶段宽度仅调整ui/stage.css：限制桌面左卡及内部网格宽度，均匀七列并保留现有小屏重排和右侧上下边界。日期功能修复与此样式修改互不占用同一文件。

预计文件：ui/surfaces.jsx、共用日期适配器、tests/ui-surfaces.test.mjs、ui/stage.css、ui/surfaces.css、public/app.js与index.html缓存版本及本任务验收文档／规范。真实鼠标验收还发现标题层挡住验证日历的翻月按钮；仅提高验证日历导航层级，保留DayPicker交互。无API、服务器、记录格式、复盘题目／插画／其他页面改动。日历仍使用真正shadcn组件；不引入依赖，不修改全局Date。可通过Git还原本批文件回滚。
