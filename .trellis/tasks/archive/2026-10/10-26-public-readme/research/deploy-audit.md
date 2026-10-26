# 部署文档核对记录

- `shendu/compose.yaml` 定义 `shendu`、`caddy` 两个服务；Caddy 暴露 TCP 80/443 和 UDP 443；应用把 `./data`、`./tmp` 挂载到 `/app/data`、`/app/tmp`。
- `shendu/scripts/install.sh` 从 Docker Debian 软件源安装 Engine 与 Compose，创建 `.env`、随机主密钥和目录；`shendu/Caddyfile` 使用 `SHENDU_DOMAIN` 反代 `shendu:3000`。
- `shendu/server.mjs` 在没有数据库时自动创建 SQLite 与 `backup-master.key`；`/healthz` 返回 `ok:true`。Node 22.13 起 `node:sqlite` 不再需要额外 CLI 开关，因此 README 和 `package.json` 的最低版本同步调整为 22.13；Docker 镜像使用 Node 24。
- 本机 Node 24.19：`npm run check` 通过，`npm test` 26/26 通过；全新空数据目录启动后 `/healthz` 返回 `ok:true`、`/api/auth/state` 显示可注册。烟测产生的数据与密钥已从本地工作区删除。
- `install.sh`、`update.sh`、`site-backup.sh`、`docker-entrypoint.sh` 均通过 `sh -n`。Compose YAML 可解析，服务、端口和数据挂载与 README 一致。
- 当前机器没有 Docker，未在本机执行 `docker compose build/up`。正式 Debian 部署须按 README 在目标服务器完成 Compose 检查、镜像构建、HTTPS 和 `/healthz` 核对。
- GitHub Actions [Verify build](https://github.com/hikling/shendu-v1/actions/runs/40278298998) 在 Ubuntu 24.04 上通过：26 项测试、Compose 配置、Docker 镜像构建及容器 `/healthz` 烟测。公开切换后，仓库页面和 API 均确认 `visibility=public`、默认分支 `main`。
- `git rev-list --objects --all` 的历史文件名扫描未发现 `.env`、数据库、内部主密钥或备份。`.gitignore` 命中这些运行路径；仓库中的 `.shendu` 文件只在 `tests/fixtures/personal/`，其 README 声明为合成测试数据。

外部依据：[Docker Debian 安装](https://docs.docker.com/engine/install/debian/)、[Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)、[Node SQLite](https://nodejs.org/api/sqlite.html)。
