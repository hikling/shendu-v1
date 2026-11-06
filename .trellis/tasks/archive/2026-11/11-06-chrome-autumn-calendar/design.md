# 边界与诊断

基线b871e97。线上公开HTML已为stagegrid2；本地Chrome/Edge连续回切36个月，普通夹具未出现重复。优先对比下载线上模块和本地模块、组件生命周期、9–12月邻接与反复方向切换、Chrome页面缩放/绘制。只读探测既有CDP，不关闭或重启用户Chrome，不读取无关页面或凭据。

实际行为属于ui/surfaces.jsx阶段私有DayPicker覆写及ui/stage.css。若确认月份树复用留下残余，仅替换月份的日期体，保留导航根与按钮焦点；不修改共享验证Calendar。任何实施须有针对症状的回归，不再只依赖当月节点总数。app/index只用于缓存修订，测试与QA证据按实际结果补充。

用户进一步确认修改时区的是My Fingerprint。普通时区/DST在五个时区2000–2050模型及Chrome连续切月正常；混合伪造local getter/offset与原生setter的实际初始化路径则能使当前阶段日历空月。具体插件的截图重复绘制尚未精确复现，不能称其源码根因已证实。

选择防止这类时区混用的结构修复：新增仅阶段使用的civil Date实例适配，用UTC字段表达传入YYYY-MM-DD，不修改全局Date，也不对用户选择的日期做UTC时间转换；提供稳定DateLib.newDate/today覆写，让所有DayPicker日期保留此实例。阶段month/today/返回当月均从字段构造；共享验证日历不变。不能直接timeZone='UTC'+TZDate：研究已证明其仍读取被伪造的系统offset，甚至使11月多出日期。农历月份验证/月底使用UTC字段检查纯公历文本，避免同一混合环境抛错。预计源码为新阶段日期模块、surfaces阶段桥接、lunar-calendar纯公历校验、两类回归与缓存；不改CSS或其他布局。
