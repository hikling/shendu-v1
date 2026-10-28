# Design / boundary

本次仅调整每日复盘视觉、插画资源和共享品牌的复用。行为差距由app.js的每日场景模板和styles.css中的日间布局/输入样式造成；业务规则仍由daily-flow.js和既有保存函数拥有，不改API、数据库和其他五类正文。

## Visual direction
保留雾蓝全幅艺术画布与大宋体标题。用有具体物件和人物的彩色编辑插画取代抽象蓝墨形体/大单字，参考仓库六类入口的纤细深色描线、奶白纸张、低饱和彩色几何、夸张人物姿态；不画一排简单线性图标。插画是完整场景，不在场景上伪造统计或读数。优先原创nativeSVG，用户已允许绘制；不需要生成栅格或外部搜索素材。

图文方向只取决于01—04组：evidence:right, reflection:left, action:right, journal:left；intro:right。每道题仍按真实prompt映射语义场景：intro沉思书写/sleep床月/energy伸展阳光/evidence记录清单/reflection回看观察/action路径计划/date日历/journal手账灯。可合并意义接近的场景，但不能所有题复用同一抽象图。

桌面左右使用两栏，相同内容宽度；翻转时不翻转插画内部文字/人物，不用transform镜像。页头和底部操作稳定。手机纵向书写优先，装饰缩小移到不遮挡输入的一侧；不为了交错打乱DOM语义或字段顺序。

输入采用清楚的浅纸白表面、深浅合宜边界、内边距和轻微阴影，hover/focus增强；数字保留大字号但给出实体输入区域，状态/日期原生控件保留可辨边框；disabled仍可读。避免重回卡片堆叠，视觉容器只围绕实际输入。

共享品牌已有header-brand/header-seal/header-wordmark及字体，是唯一样式归属。抽出共用品牌内部标记，daily复用同类名与字体/尺寸/阴影，移除daily-canvas-brand中重写印章/字形的规则。若品牌可点击，走attemptNavigate或公共data-nav，busy禁用且dirty提醒不变。

## Files
app.js:语义插画映射/交错场景属性/品牌复用。styles.css:交错布局、可辨控件、品牌漂移清理。index.html:缓存版本。assets/daily/:原创SVG与来源说明。DESIGN/UX-CONTRACT/README/spec/docs:对齐最终实现。

## Verify / rollback
桌面01/02/03/04截图，320/390/720/820宽度、最大数字、长文本、focus/error、已保存/只读/dirty退出、减少动态/白色主题。保留现有表单DOM挂载与事件。语法/targeted10daily-flow；API未改无需重复全备份suite。独立check代理审查。版本化资源URL，回滚此UI提交即可，无迁移。

用户已明确授权这轮修改，沿用会话的Trellis实施、提交和推送授权，不重复访谈/确认。
