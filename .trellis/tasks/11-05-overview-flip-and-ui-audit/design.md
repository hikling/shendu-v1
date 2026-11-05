# 技术设计与边界

概览交互由app.js的renderOverview/setOverviewType/closeOverviewTypes和专属CSS负责；移除浮层与散开粒子模板，保留原生导航按钮，在一个按钮内部用前后两个纯装饰面实现翻转，aria-label提供稳定完整名称。无额外焦点目标，无展开ARIA。使用独立overview-entry.css覆盖旧入口视觉，并删除失效的信息／粒子规则，保留六类尺寸断点与轮播。

选色由applyTheme/openTheme/openSettingsTarget拥有。取消openTheme与入口，applyTheme固定批准的默认三色，仍读取reduceMotion；设置增加独立减少动态选项，保存时保留已有theme对象其他字段，沿用API兼容旧备份，不迁移DB或删除已保存颜色数据。

遗留UI由页面／弹层清单核查。重点是仍无本地插画的auth以及通用确认／重认证表面；通过局部模板与独立CSS统一纸面、宋体、输入边界、按钮及静态相关插画。复用真实shadcn控件和已审核本地图。装饰不得改变验证、焦点、提交或权限。各实现者只编辑自己拥有的函数段，不格式化整个app.js。

主会话拥有概览函数、overview-entry.css、资源接入、规范与最终验收；设置实现者拥有applyTheme、设置／主题函数和相关工作区CSS；遗留界面实现者拥有renderAuth／sessionExpired与通用表面CSS及审计清单。独立检查再审阅集成。保存／账户／备份／轮播／艺术复盘业务与API协议不改。
