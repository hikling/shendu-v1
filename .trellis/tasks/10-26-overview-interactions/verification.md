# 验证证据

## 分类与导航

- 分类外层固定尺寸；触发按钮与信息卡内进入按钮分开，单击/Enter/Space切换，aria-expanded/controls、hidden及分组名称同步。Escape回焦，外部点击关闭。
- CUA使用真实public源码和合成API数据。在320、390、540、680、960、961、1100、1280、1281、1660px逐一激活六类，共60次；六个容器文档坐标和宽度全部不变，放大比例1.14，信息全部在可视布局视口内，961px以上均在左侧。
- 1280px及以下采用三列，961–1280面板220px、更宽桌面240px；手机下方按列对齐。验证时使用文档坐标排除浏览器为了显示激活按钮而产生的自然滚动。
- 390/1660px各测试六次「展开→进入」均到正确复盘页。Enter展开、Tab进入CTA、Escape关闭并回焦通过。
- 顶部所有触发器计算样式为透明背景、border 0、shadow none；概览和历史当前文字分别为青绿和蓝色；原路由与权限行为保留。

## 轮播

- 外层button保持motion path和命中区不变，内层surface负责抬升/放大。
- 真实指针命中空白轨迹时12张卡全部running；进入可见卡片时全部paused，跨工具调用仍保持悬停。计算surface矩阵为scale1.055、Y=-14px，root transform none，阴影明显增强。
- 移回空白后12张卡全部恢复running。未把暂停范围扩大到整个轨迹窗口。

## 阶段与日历

- 复用rightRail唯一DOM和原日历/阶段/待验证绑定，改为居中层；无需复制ID或重建表单。
- 320×640、390×844、680×700、961×900、1280×900、1660×1000均居中且在可视布局视口内；手机内部滚动可用。中心依据documentElement.clientWidth，正确扣除原生滚动条。
- 背景header/main inert、body滚动锁、Tab/Shift+Tab循环、Escape/关闭按钮/遮罩关闭与回焦通过。
- 月份切换到11月及返回10月后焦点保留对应箭头。编辑阶段打开原设置子弹窗，父层inert、子层z110，Escape关闭后父层恢复且焦点回到阶段编辑按钮。
- 日期打开2026-10-01原记录后父层关闭、无body锁和残留inert，页面标题为每日复盘。
- 在今日草稿写入合成文字，经日历跳转出现未保存确认；取消后文字原样保留。只丢弃本次测试合成内容，没有写入后端。

## 质量与交付

- 系统减少动态效果CSS保留；账户设置下信息/弹窗animation为none、图标transition为0s。空记录仍有六类入口。浏览器error日志0条。
- npm run check、git diff --check、Trellis context validate通过；designmd lint为0 errors、7个既有警告和1条info。
- Premium strict audit仍是既有15项旧结果，无新增；旧表单与全局样式未越界重写。
- 并行只读审查未发现阻断问题；眉题标签和设计方案过时描述已修正。
- README、DESIGN、UX-CONTRACT、frontend/ui-quality、四张预览同步。CSS/JS缓存版本overview6。详细原始测试结果和手机/悬停截图在忽略的shendu/tmp。
- 浏览器临时尺寸已还原，预览标签关闭。服务端、持久化和API未改；CI执行完整测试、Compose/镜像构建及启动健康检查。
