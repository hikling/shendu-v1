# 交互设计

分类保持固定尺寸容器，内部独立 button.overview-type-trigger 控制 .is-expanded 与 aria-expanded；信息卡 .overview-type-info 是独立分组，包含进入按钮，避免嵌套按钮。同时仅开一个，Escape/外部点击关闭。图标用transform原位放大并增加投影。桌面信息从左侧以右边缘为原点展开；1280px以下三列确保左侧空间，960px以下在下方按列防碰撞。不通过容器width制造挤压。

导航保持现有语义与路由，仅用文字颜色表达当前项。分类路由沿用各类别色，概览青绿、历史蓝、行动琥珀。红色品牌不变。保留焦点轮廓。

运动记录卡保留真实运动/命中button，增加内部.overview-record-surface承载抬升、放大、重阴影和查看箭头过渡，避免移动命中区造成悬停反复。循环路径和真实卡片暂停规则保留。

阶段日历复用现有rightRail/setRailOverlayOpen作为居中模态层，保留原日历ID与绑定，避免复制DOM及重复监听。增加背幕/关闭按钮、背景inert、滚动锁和回焦。选择日期/记录前先关闭父层再调用未保存守卫；阶段设置与验证继续使用openModal子层，临时将父层inert，关闭后恢复父层按钮焦点。旧页面持久栏主体保留，顶部按钮统一打开居中层。

修改app.js/styles.css/index.html（缓存版本）、DESIGN/UX-CONTRACT/规范与README预览；不修改服务端和表单。验证固定位置、展开边界、指针暂停、弹窗焦点/月份/日期/设置路径、窄屏和减少动态效果。
