# Boundary

引导变化由reviewIntros.enter每次接受导航都消耗随机池引起。为已存在记录提供稳定选择，优先使用真实ID（及类别）决定文案，不依赖当前状态/修改时间/正文；旧数据无需迁移。显式历史记录及概览按周期恢复的既存记录必须共用相同身份。未保存的新记录保留当前随机池且本次编辑/保存/回引导不跳词，取消离开不得消耗新选择。

仅改review-intros.js选择和app.js导航选择边界及相关测试；不往用户记录写隐藏字段，不改API。若复盘首次保存得到新ID，保持本次屏幕文案；后续重新进入按稳定身份选择。

history-archive.css以relative偏移将整个history-archive-visual上移20px（手机12px）；数字仍是图内容的一部分。styles.css以relative top将overview-hero和overview-types下移24px（手机16px），不改变其文档流尺寸或overview-reel的任何属性，确保轮播原点不动。检查入口下缘与轮播装饰/焦点空间。
