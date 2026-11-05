# 实现边界

1. 概览由renderOverview中的背面标题和overview-entry.css拥有。明确分两行（日/周/月/季度/年度/重大 + 复盘/决策），放大到约28px（桌面128图标）和22px（小图标），其余交互保持。
2. styles.css提取共享reading-width=1480px、reading-gutter，与历史/行动容器一致；六类head/intro/editor使用同一外框、内边距与插画边界，保持完整类别背景。
3. 行动验证的实际底色是body的暖纸色叠加左上白色和右上暖灰径向渐变。提取为共享workspace-canvas；指定工作区与设置Dialog使用同一背景值，卡片、插画、类别色保留。
4. app.js中users路由成为全角色的账户管理：原个人密码/安全退出表单迁入页面，管理员成员表独立异步装载。普通成员不调用/api/admin/users。查询和管理员操作只刷新成员区域，保留个人表单。加载回调须绑定原页面所有者，避免离开后覆盖其他页面。
5. 合并桌面/手机菜单与设置入口；设置中的账户入口关闭Dialog后走原attemptNavigate保护到users，不留下modal/inert状态。保留/api/me/password、/api/auth/logout与管理员接口、密码约束及权限。

## 文件与责任
- 主会话：overview局部模板/overview-entry.css、styles.css、workspace-pages.css外层背景、index缓存、文档和浏览器集成。
- 实现子代理：app.js的topbar账户入口、renderUsers/bindUsers/管理员操作刷新、openAccount及设置账户路由；账户整合相关workspace-pages.css样式与意义明确的角色/表单/异步所有者测试。不得改概览/复盘/根样式。
- 检查子代理独立审查本次全部diff，父会话完成实际渲染验收。

不改服务端、持久化结构、认证方式、复盘字段与保存锁定、概览轮播、插画资源或依赖。
