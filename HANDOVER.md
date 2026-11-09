# 慎独 · 开发与交接手册

源码、设计素材、测试与维护规范统一通过 [GitHub 的 `main` 分支](https://github.com/hikling/shendu-v1/tree/main)交接。轻量交接包只提供仓库/文档入口、版本信息与校验清单，总大小小于 20 KiB，不重复装入项目文件。

项目仓库：<https://github.com/hikling/shendu-v1>。日常维护以 GitHub `main` 为准；需要复现交接时点时，按包内 `VERSION.json` 中的提交和应用目录版本查阅。此次不交接运行站点的账户、个人复盘、数据库、密钥或备份，不执行线上迁移。

## 1. 接手后先读什么

1. [README](README.md)：产品入口、本地运行、当前一键部署和更新方式。
2. [PRODUCT](PRODUCT.md)、[DESIGN](DESIGN.md)、[交互契约](UX-CONTRACT.md)：已经确认的产品、视觉和行为边界。
3. [部署与维护](docs/deployment.md)、[迁移与回退](UPGRADING.md)：环境、数据、密钥、备份和故障处理。
4. [组件接入](docs/shadcn-adoption.md)、[前端规范](.trellis/spec/frontend/index.md)、[后端规范](.trellis/spec/backend/index.md)：修改对应层之前阅读。
5. [安全检查记录](docs/security-audit.md)、[CI 工作流](.github/workflows/verify.yml)：既有检查范围、限制和自动化门禁。

开发由 Trellis 管理，工作流见 [.trellis/workflow.md](.trellis/workflow.md)。本手册、项目规范、素材源及历史 `docs/*-qa/` 验收材料均在 GitHub 仓库或其 Git 历史中查阅，不进入轻量包。包内文档链接会直接引导到仓库。

## 2. 第一天：在隔离环境运行

先从 GitHub 克隆项目，需要 Git 和 Node.js **22.13 或以上**，推荐与容器一致的 **Node.js 24**。所有 npm 命令都在克隆后的 `shendu/` 目录执行：

```sh
git clone https://github.com/hikling/shendu-v1.git
cd shendu-v1/shendu
npm ci
npm run check
npm test
npm start
```

打开 <http://localhost:3000>。`npm test` 与 `npm start` 会先自动构建前端；首次启动生成新的 `shendu/data/`，第一个注册账户成为超级管理员，然后关闭公开注册。请使用虚构资料验收，不需要任何线上数据或图像 API 密钥。

`npm run build` 单独构建前端；`npm run dev` 监视服务端文件，修改 `ui/` 后仍需重新构建。服务启动后，可在另一个终端执行：

```sh
cd shendu-v1/shendu
npm run smoke:ui -- http://127.0.0.1:3000
```

本地端口、数据目录和 Windows 配置示例见[本地 Node.js 运行](docs/deployment.md#本地-nodejs-运行)。不要让测试实例连接正式数据目录。

## 3. 轻量交接包与 GitHub 版本

轻量 ZIP 内只有 `shendu-v1-handover/README.md`、`VERSION.json` 和 `HANDOVER-MANIFEST.json` 三个文件。它是交接入口，开发、构建和部署都从 GitHub 获取完整项目；应用代码、插画、测试、规范和 Git 历史不装进 ZIP。

本地运行按上一节克隆 `main`。需要核对交接时点时，在仓库根目录查看当前提交：

```sh
git rev-parse HEAD
```

将其与 `VERSION.json` 记录的提交比较；`main` 后续继续前进属于正常维护。需要精确复现时可使用对应提交的独立克隆，生产自动更新则要求正常的 `main` 克隆。服务器安装器、更新器和 `prepare-image.sh` 依赖 Git 信息。旧 `Shendu` 或旧 ZIP 站点的数据迁移仍按 [UPGRADING](UPGRADING.md) 操作，不能直接更换旧仓库的远端后拉取。

## 4. 代码与资源地图

| 位置 | 负责什么 |
| --- | --- |
| `shendu/server.mjs` | Node.js ESM HTTP/API、SQLite、账户会话、加密、记录规则与备份接口 |
| `shendu/public/app.js` | 原生 JavaScript 路由、状态、页面模板、表单收集与导航 |
| `shendu/ui/runtime.jsx`、`ui/entry.jsx` | React 组件岛的注册、挂载、桥接与清理 |
| `shendu/ui/components/ui/` | 本地真实 shadcn/ui 组件源码，基于 Radix 等依赖 |
| `shendu/vite.config.js`、`package-lock.json` | 前端构建、依赖锁定与第三方许可汇总 |
| `shendu/public/styles.css`、`overview-entry.css` | 应用基础样式、六类入口与沉浸画布 |
| `shendu/public/history-archive.css`、`workspace-pages.css` | 历史、行动与账户等工作区页面 |
| `shendu/ui/stage.css`、`lunar-calendar.js` | 阶段日历布局、农历与节气 |
| `shendu/public/daily-flow.js`、`extended-flow.js` | 每日及另外五类的逐题填写流程 |
| `shendu/public/backup-schedule.js` | 北京时间定时计划、到期判断及十天日志日期边界 |
| `shendu/public/review-schema.js`、`review-metrics.js` | 共享问题配置与草稿指标无损同步 |
| `shendu/public/daily-calendar.js`、`verification-policy.js` | 北京日历日期处理与最早验证日期 |
| `shendu/public/overview-reel.js`、`record-art.js` | 概览连续长卷与历史/行动配图规则 |
| `shendu/public/assets/`、`art/`、`output/imagegen/record-library/` | 本地发布插画、生成/加工说明与保留的原始成品 |
| `install.sh`、`shendu/scripts/install.sh`、`update.sh` | 仓库入口、安装与更新；后两者在 `shendu/scripts/` |
| `shendu/scripts/prepare-image.sh`、`site-backup.sh`、`admin-cli.mjs` | 镜像准备、加密快照与离线管理工具 |
| `shendu/compose.yaml`、`Dockerfile`、`Caddyfile` | 生产容器、构建与 HTTPS 反向代理 |
| `shendu/tests/`、`scripts/`、`.github/workflows/` | 应用回归、部署场景与 CI |

上表文件均从 GitHub 获取。`node_modules/` 与构建生成的 `shendu/public/ui/` 使用锁定依赖重新生成。运行环境不依赖 Python；交接打包、部分开发测试和素材加工工具另有各自依赖。

## 5. 继续开发时必须保留的行为

- 产品是给自己使用的个人成长复盘，六类为每日、每周、每月、90 天、年度和重大决策。
- 概览六类入口在悬停/键盘聚焦时原位翻面，背面显示简短类别名，配合独立散开装饰；点击图标直接进入。长卷只放已验证记录，同类型同周期只出现一次，完整一轮后连续循环。
- 保持红印章/宋体品牌、六类独立配色与本地插画。顶部没有独立“复盘”菜单，设置及阶段与日历是正常页面。减少动态效果时仍能完成所有操作。
- 复盘开场短句入场时随机选取并保持稳定，逐题填写，手动保存草稿。完成后锁定原记录，历史记录只读，之后单独进行行动验证。
- 切题保留全部字段挂载与值；只切换可见性。不得丢失隐藏内容、字段 ID、提交格式、未保存离开保护或只读限制。
- “行动受阻的情况”和“准备如何应对”在同一页。每日两项都必填；其他五类应对必填、受阻情况可选，以服务端校验为准。
- 六类文字输入统一为 200px 固定高度，超长框内滚动；已锁定 textarea 使用 readonly，保留键盘阅读和复制。完成后提供历史和行动验证双导航，移除局部填写验证入口。
- 阶段与内容设置支持每类最多 30 个问题的增删、恢复与必填设置，阶段指标支持 0–12 项；保留行动、应对、验证日期及决策名称。当前草稿跟随配置，完成或过期记录按快照读取。删掉的草稿答案和指标内容保留，不因配置修改擦除。
- 六类内容采用统一宽度上限，插画交错排布并与当前内容居中对齐；移动端按正文、居中插画、页脚排列，不为装饰制造溢出。

验证等待由原记录完成时的北京时间日期计算：每日当天；周 **7 天**、月 **30 天**、季 **90 天**、年 **250 天**；重大决策 **3 个自然月**，月末按目标月末收敛。预期验证日期不能绕过真实等待期限。

日历按 `Asia/Shanghai` 的民用日期处理。已有防护针对 Chrome 时区指纹插件造成的 API 不一致和夏令时重复日期；不要换回宿主本地时区加减毫秒的日期实现。

React 只拥有自己的组件岛；原生页面替换前要从最深层清理 React 根。DayPicker 自定义组件保持模块级稳定，避免切月后焦点丢失。修改静态资源时同步更新对应 `?v=` 引用并重建，避免一年期缓存继续提供旧文件。

## 6. 安全、数据与备份边界

此次交接没有正式站点的数据恢复材料。新接手者本地启动得到的是独立空站，不能据此恢复原站。

维护真实部署时，原 `.env`、数据库、`data/backup-master.key` 与相关密码必须成套保管；丢失原主密钥后，不能用新随机密钥解密旧资料。升级不删除 `data/`、配置、备份或 Caddy 卷。

| 备份形式 | 入口与边界 |
| --- | --- |
| `.shendu` | 应用内个人加密备份，保留原用户名/归属校验与备份密码 |
| `.shendu-site` | 超级管理员通过网页备份和恢复整站 |
| `.shendu-db` | 服务器加密数据库/主密钥快照，使用对应密码文件恢复 |

CLI 恢复必须先停止应用，并先在隔离环境演练。三个入口不能互换文件。测试应覆盖错误密码、篡改/损坏、归属、重复、已完成保护、失败回滚及输出路径保护；旧兼容解析器与合成测试样本不是可随意删除的死代码。

外部 WebDAV/S3 备份保留 HTTPS、DNS/IP 限制、固定解析地址、不跟随跳转、超时与并发限制。定时按北京时间具体时分/星期执行，测试不计入备份日志或改变成功状态；运行记录只保留十天的真实备份结果并带目标快照。数据库新增计划与日志元数据需和网页整站备份/CLI快照一起维护。直接运行 Node.js 时默认不信任代理头；只在可信反向代理隔离应用端口的部署中开启代理信任。

普通管理员通过应用不能读取其他成员的复盘，但服务器维护者持有运行时解密能力。公开源码不等于公开用户数据，也不代表端到端加密。既有安全检查是有时间和环境边界的证据，后续仍需更新依赖并测试恢复。

## 7. 服务器安装、更新与排错

正式部署优先使用 [README](README.md#debian-1213-服务器部署) 的当前命令，推荐 Debian 12/13、root shell、Docker Compose + Caddy，支持 Linux amd64/arm64。域名需正确解析，TCP 80/443 可达。

默认下载 GitHub Actions 发布、带 SHA-256 校验的预构建镜像，版本为 `deploy-<git rev-parse HEAD:shendu>`。相同版本本地镜像通过检查后复用；服务器默认不执行 npm/Vite 编译。仅明确设置 `SHENDU_BUILD_FROM_SOURCE=1` 才进入源码构建。

根安装入口复用已存在的克隆，**不会自动拉取其代码**。旧安装卡在编译时，按 README 的“旧版安装卡住或中断后重试”先快进代码，再运行安装器；不要删配置或数据重装。

运行中的站点使用 README 的“更新现有部署”命令下载最新更新器，默认示例显式选择先生成加密快照。更新器会先复制自身再拉取，旧进程不会在执行中途变成新版；只在现有目录重跑旧脚本可能继续触发旧问题。选择备份后，备份失败必须阻止拉取与容器替换。

提交到 `main` 和 CI 成功不会自动修改自托管站点，仍需站点维护者执行更新。公网可用性还取决于 DNS、证书、防火墙和下载网络；镜像尚未发布时应等对应 Actions 成功后重试。

排错先看 `docker compose ps`、应用日志、`/healthz` 与 `smoke:ui`；配置展开会包含密钥，不要公开完整 `docker compose config` 输出。密钥不可用时恢复原密钥，不要生成新密钥覆盖旧站。细节见[故障处理](docs/deployment.md#故障处理)。

## 8. 交接包内容与校验

ZIP 内只有一个 `shendu-v1-handover/` 根目录，且只包含以下三个文件：

| 文件 | 用途 |
| --- | --- |
| `README.md` | 简短接手说明及公开 GitHub 仓库、在线手册和部署文档链接 |
| `VERSION.json` | 本次交接对应的 Git 提交与应用目录版本信息 |
| `HANDOVER-MANIFEST.json` | 入口文件的成员、大小和 SHA-256 校验清单 |

整个 ZIP 必须小于 **20 KiB**，旁边附 `.zip.sha256`；程序、插画、原始 PNG、测试、规范、完整手册、历史验收材料及运行文件全部留在 GitHub 或各自受控环境，不复制进包。所有已采用插画及加工源文件继续保留在 GitHub，运行现有图片不需要 API 密钥。

打包与校验需要 **Python 3.11 或以上**；只有打包需要 Git，并在干净的源码克隆根目录运行。校验器从 GitHub 项目中获取，它的 `--verify` 操作不依赖 Git：

```sh
python scripts/package-handover.py --output-dir ../交接包
python scripts/package-handover.py --verify ../交接包/shendu-v1-handover-COMMIT.zip
```

将 `COMMIT` 替换为实际文件名中的 12 位提交号；ZIP 与相邻 `.zip.sha256` 保持原名。重新打包前先提交并同步要交接的改动到 GitHub，程序从提交元数据生成这三个小文件。校验能发现损坏和异常成员，来源可信度仍应与公开仓库核对。

## 9. 插画、组件与授权

已采用图片均随 GitHub 仓库源码提供，部署无需生成服务、API 密钥或生成者账户。运行 WebP 与原始 PNG、关键词、审阅哈希及加工说明相互对应，见[插画维护说明](art/record-library/README.md)。新增或重新加工素材后，重新审阅、更新清单与缓存版本。

插画来源与加工元数据分布于[概览](shendu/public/assets/overview/README.md)、[长卷](shendu/public/assets/reel-emotions/README.md)、[每日](shendu/public/assets/daily/README.md)、[另外五类清单](shendu/public/assets/extended/manifest.json)、[历史与行动](shendu/public/assets/records/README.md)。保留作者/来源和已有授权边界，公开仓库本身不授予额外的素材使用许可。

shadcn/ui 的 MIT 声明保留在[组件目录](shendu/ui/components/ui/LICENSE.md)；其他浏览器依赖许可由构建汇总到 `/ui/licenses.txt`，见[第三方声明](THIRD-PARTY-NOTICES.md)。不要把组件的许可证自动套用于整个项目或插画。

## 10. 接收验收清单

- ZIP 小于 20 KiB，仅有约定的三个文件；校验值与清单一致，GitHub 入口和版本提交可访问。
- 从 GitHub 克隆项目后，核对目标提交与应用目录版本；在 `shendu/` 执行 `npm ci`、`npm run check`、`npm test`，再检查启动、`/healthz` 和 `smoke:ui`。
- 使用虚构账户核对注册/登录、六类新建/草稿/完成、历史只读、行动验证期限、日历、账户管理及个人备份导入导出。
- 桌面与窄屏无内容遮挡或横向溢出，键盘可操作，减少动态效果有效；复盘切题不丢输入，返回历史来源正确。
- 部署相关修改另跑 Linux 安装/更新隔离场景与真实容器检查，以对应版本的 Actions 结果为准；没有运行过的环境不要标为已验证。
- 接收者能找到数据边界、恢复方法、素材来源和维护规范；需要正式数据迁移时另行安排受控交接，本包不承担该步骤。
