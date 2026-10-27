# 设计与实现边界

分类恢复overview8的介绍结构与样式，移除motion翻滚层/关键帧，保留burst与直接导航。

轮播延续个人复盘索引卡气质，以类别签、日期、标题、摘录和状态组成清楚层次；使用至少六种来自既有Iconfont合集52510的插画，新增两款并复用同合集四种不同构图，保留来源与修改说明。将插画处理成适合纸卡的彩色小构图，去除入口式大底板/时间印记。身份稳定散列选择插画及版式，避免同一类别全部相同；同一记录循环副本保持一致。装饰图aria-hidden、无网络依赖、不参与命中。

共享button继续负责运动和点击，overview-record-surface负责新排版和悬停。两种有序版式仅调整日期/插画位置，不重排真实信息或添加虚假统计。扩大卡片至桌面280px左右、手机240px，约270px高，以实际内容与浏览器验证确定；bindOverviewArc从实际尺寸重算路径。

改动限app.js/styles.css/index.html、reel本地资源、DESIGN/UX-CONTRACT/规范/README预览与任务证据。优先复用记录缓存、formatDate、STATUS、data-nav与attemptNavigate。验证照片来源、hash稳定、重复卡一致、边界/裁切、真实指针及减少动态效果。

