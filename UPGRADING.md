# 迁移旧部署到 shendu-v1

全新安装请按 [README](README.md#debian-1213-服务器部署) 操作。已在 `/opt/shendu-v1` 运行的站点，用 README 中的更新脚本即可。本页用于从旧 `Shendu` 仓库或 ZIP 部署迁移现有资料；**新仓库有独立 Git 历史，不能在旧目录直接把 `origin` 改成新地址后 `git pull`**。

以下示例假设旧站目录为 `/opt/Shendu`、新站使用 `/opt/shendu-v1`。在 Debian 服务器的 root shell 执行，并把路径按实际部署位置调整。迁移前为每个账户另存个人 `.shendu` 备份及其密码；旧版 `.shendu-site`、`.shendu-db` 不作为新版直接导入的兼容承诺。

## 1. 停旧站并保留完整副本

```sh
cd /opt/Shendu/shendu
docker compose down
cd /opt
umask 077
backup_dir="/opt/Shendu-before-v1-$(date +%Y%m%d-%H%M%S)"
cp -a Shendu "$backup_dir"
printf '旧站副本：%s\n' "$backup_dir"
```

确认副本含 `shendu/data/shendu.db`、`shendu/data/backup-master.key`、`.env`，以及可能存在的 SQLite `-wal`、`-shm` 文件。若旧站把 `SHENDU_MASTER_KEY_PATH` 设在自定义位置，另行保存该密钥并在新站沿用。**只复制数据库、不复制原密钥会导致资料无法解密。**

## 2. 克隆新仓库并复制配置、数据

```sh
git clone https://github.com/hikling/shendu-v1.git /opt/shendu-v1
cd /opt/shendu-v1/shendu
cp -a /opt/Shendu/shendu/.env .env
mkdir -p data tmp
cp -a /opt/Shendu/shendu/data/. data/
chmod 600 .env
docker compose config >/dev/null
docker compose up -d --build
docker compose ps
```

这里保留旧站的域名、内部加密密钥与数据库，不运行新站的 `scripts/install.sh` 来重置 `.env`。若原站有自定义外部密钥路径、不同目录挂载或其他 Compose 改动，应先手工把对应设置映射到新站，再启动。新旧部署不能同时运行：两者使用相同的容器名与域名端口。

## 3. 验证

```sh
curl -fsS https://你的实际域名/healthz
cd /opt/shendu-v1/shendu
docker compose logs --tail=200 shendu
```

健康检查应包含 `"ok":true`。用原账户登录，核对概览、六类复盘、完成和验证状态、阶段设置、主题、权限及备份目标。再导出一份新版个人备份，在隔离环境测试导入。旧站目录和副本应保留到核对完成。

## 回退

若验证失败，先停止新站，再启动仍保留原数据的旧站：

```sh
cd /opt/shendu-v1/shendu
docker compose down
cd /opt/Shendu/shendu
docker compose up -d --build
docker compose ps
```

回退使用的是切换前的旧数据库；在新站运行期间新增的记录不会自动回到旧站。不要把新站数据库单独复制到旧代码目录。代码、数据库、内部密钥和配置必须作为一组恢复；正式迁移前，建议先用旧站目录的副本在隔离环境演练。
