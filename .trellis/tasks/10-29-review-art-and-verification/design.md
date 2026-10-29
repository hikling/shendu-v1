# 设计

- `public/verification-policy.js` 是浏览器和 Node 服务端共用的纯函数，输入类别与北京时间日期，返回最早可验证的 ISO 日期。
- `app.js` 的日历最小日期、当前问题与最终校验统一调用该函数。按钮“今天”在跨周期类别改为“最早可选”；锁定历史只读保持原日期。
- `server.mjs` 在完成接口校验预期日期，在验证提交接口根据 `completed_at` 再校验实际最早日期。既有 `expectedDate` 与 `actualAt` 字段保持不变。
- 每个 `data-review-phase` 映射一张专属 WebP；底层 PNG、提示词及 SHA256 保存在新素材目录。图片不参与记录数据。
- `.extended-review-flow.type-*` 范围内覆盖纸色、卡纸色、正文、强调色、细线和装饰元素；不改概览及每日选择器。
