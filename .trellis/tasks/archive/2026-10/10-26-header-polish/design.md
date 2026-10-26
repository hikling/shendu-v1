# 设计与边界

共享实现继续由 topbar/navItems/bindCommon 负责，CSS 由既有 header 与 overview 分区负责；不增加第二套导航组件或修改 API、表单和保存流程。

品牌依据旧版 Shendu-plan-snapshot 的 .seal/.brand-cn 和「慎獨」文本：复用红色渐变印章，摆正，继承原宋体及字距。主句只删除概览行末逗号。

桌面入口112px，平板96px，手机84px。放大后分类三列断点提前到1100px，避免右侧250px信息卡导致溢出；使用 --type-size 推导图片、容器和提示位置。

顶部采用浅色悬停、白色柔和选中胶囊与小圆点；复盘下拉用两列菜单、用途/时长与分类色图标。展开轻微位移淡入，减少动态效果时禁用。保留点击开关和 aria-expanded，不引入自动悬停打开。方向键进入与移动，Home/End定位，Escape返回触发器，焦点移出和点击外部关闭。

修改 app.js、styles.css、index.html 缓存版本，及 DESIGN/UX-CONTRACT/产品主句/README预览与Trellis规范。回滚使用本次提交的反向提交，无数据迁移。
