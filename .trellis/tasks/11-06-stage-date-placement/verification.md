# 验收

仅阶段日历结构、定位、测试和缓存版本变更。原生table子树换为模块稳定div ARIA槽，每日格显式civil星期列与aria-colindex；共享验证日历不变。

- Chrome156：48组实际日期横/纵坐标、六周、月/年/闰年、320–1280px、空/有记录、有效隐藏占位注入、月按钮焦点、退出复盘返回日期和减少动效通过。
- Chrome新建隔离配置真实页面缩放80/100/110/125/150%：11月1日唯一且在周日；body zoom=1，无横向溢出。
- Edge156独立正常/占位折叠、1120/821/390/320px、空行高度、跨年焦点通过。独立源码和QA脚本审查无阻塞发现，ARIA列号建议已落实。
- build/check/151项测试/健康与本地JS/CSS烟测/diff--check通过。
- 公开网站下载资源stagegrid1在本地隔离环境确认隐式占位失败，SHA256在docs/stage-placement-qa/frozen-production.json。未进入或修改真实账户，直接线上渲染连接超时。
- 用户截图两次绘制的确切触发条件仍未复现；注入错列的证据不作为此根因的证明。修复与验收边界见research/break-loop.md。

功能提交4c745f1f8b5384ec401f026246b6189bb353ce6b已推送main，准确SHA的GitHub Actions42152530590成功：https://github.com/hikling/shendu-v1/actions/runs/42152530590 。包含Linux检查/151项测试、Docker镜像及启动/资源烟测。

隔离3192/3193服务已停止，无残留监听。线上公开HTML再次读取仍为stagegrid1；本次未执行服务器部署，需按README更新到stagegrid2，不能把推送main当作已上线。
