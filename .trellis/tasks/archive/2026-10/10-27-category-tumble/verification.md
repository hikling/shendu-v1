# 验证

- 六类介绍DOM均只有STRONG类别名与P说明，无按钮、用途标签、时长和页脚；删除对应无用CSS。trigger通过aria-describedby关联说明，仍使用data-nav单击直达。
- 完整图标加入独立overview-type-motion层，780ms单次跃起翻滚：0→-18→370→360度，结束矩阵回到正立identity；mark保留1.14放大/阴影，原粒子保留。独立层pointer-events:none，不改变按钮命中。
- CUA使用真实public源码和合成API逐一悬停6类，全部动画名/时长/单次状态正确，6个容器文档坐标及宽度不变。实际翻滚截图docs/overview-burst.png、结束后的纯文字截图docs/overview-info.png。
- 离开动画名none，再进入overview-icon-tumble，支持重播；动画结束为正立矩阵。36项320/390/960/961/1280/1660px文字卡边界检查全部通过、无文档横向溢出。
- 390/1660px各6次图标点击均进入正确页面；真实Tab跨分类打开文字、Escape关闭、Enter进入每周通过。减少动态效果下翻滚animation none、粒子display none，文字仍可见。
- 浏览器error日志0条；原始结果在忽略的shendu/tmp/tumble-results.json。临时视口还原、标签和合成预览服务关闭。
- npm run check、git diff --check、Trellis context validate通过；designmd lint为0errors/7个既有warning；Premium strict仍为既有15项，无新增。
- README、DESIGN、UX-CONTRACT和前端规范已同步。CSS/JS缓存版本overview9。无API/持久化改变，CI执行完整测试和容器构建。
