# Boundary and design

变化位于浏览器全局滚动条、复盘既有导航入口与账户偏好。保持六类画布/题序、写入API及复盘数据不变。styles.css提供统一全局scrollbar tokens及标准/WebKit/forced-colors样式；workspace-pages.css只调整设置行布局。

review-wheel.js共享手势控制器绑定当前复盘画布，使用既有上下题按钮及校验。累计距离达阈值，一次连续手势仅导航一次，须安静间隔且冷却结束才解锁；同手势曾滚内容则整段让给内容。弹窗、busy、关闭偏好、非题目页、缩放/横滚不导航。所有字段保持mounted，离开旧画布不处理事件。

偏好沿现有theme设置与加密备份通路新增reviewWheelNavigation，缺省true、显式false关闭；normalizeTheme统一默认与白名单。settings同一表单提交reduceMotion及新开关，保留兼容字段、dirty/owner/失败重试，不增加schema或localStorage。

主代理负责CSS、设置UI及整合；worker负责共享滚轮控制器和绑定/测试，另worker负责后端偏好及HTTP/备份测试，互不回滚他人修改。验证实际导航、设置DOM/HTTP及备份，浏览器验收桌面/窄屏与滚动优先。
