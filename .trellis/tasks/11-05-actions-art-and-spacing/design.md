# 设计与边界

动作页现有问题位于renderActions/actionCard模板与styles.css作用域：页头三列把插画压成220px；记录插画限制在150x140标题行，时间对半铺满整卡且字号约11px，造成视觉分散。共享verificationTimes还用于验证弹窗，不能借本次调整更改其数据和通用布局。

页面保持现有绿色纸感和类别色。页头变为左侧标题说明、右侧大幅行动场景，两组数量移到下方首个内容区右上方。页头场景可跨越原分隔线的视觉边界，靠近首个绿色框，使用明确层次和pointer-events:none，实际按钮始终可点。

记录上半部采用“左侧标题及紧凑时间配对／右侧大插画”，插画跨标题和时间的高度，到下方连续阅读框上沿。正文框保持原计划、结果、调整的顺序和完整内容。桌面少留空白，手机缩小插画并把时间按空间重排；不要用截断正文换取紧凑。

实现者只拥有shendu/public/app.js中actionCard/renderActions相关模板、styles.css中actions专属规则及必要ui/compat.css动作时间规则。不可改API、记录数据、日期工具、验证对话框、概览/历史/沉浸复盘、UI挂载生命周期。主会话负责入口缓存版本、规范文档、实际浏览器与main同步。

复用真实shadcn Card/Badge/Button与原native事件绑定。display:contents宿主仍存在，注意直接子规则及统计Badge宿主，不用nth-child等错误假定。无需新图、外部素材或生成图片。
