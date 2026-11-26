#!/bin/sh
# Maintain host storage before invoking the existing application updater.
set -eu

fail() {
  printf '更新失败：%s\n' "$*" >&2
  exit 1
}

[ "$#" -le 1 ] || fail '用法：sh update.sh [项目目录]'
[ "$(id -u)" -eq 0 ] || fail '请先进入 root 终端。'
requested_repo="${1:-$(dirname -- "$0")}"
repo_dir="$(CDPATH= cd -- "$requested_repo" && pwd)" || fail '找不到项目目录。'
app_dir="$repo_dir/shendu"
[ ! -L "$repo_dir" ] && [ -d "$repo_dir/.git" ] && [ ! -L "$repo_dir/.git" ] && [ -f "$app_dir/scripts/update.sh" ] || fail '请在完整的慎独 Git 克隆中运行。'
if [ -r /proc/self/status ] && LC_ALL=C awk '/^Uid:/ { exit ($2 != 0) }' /proc/self/status 2>/dev/null; then
  [ "$(stat -c %u "$repo_dir")" -eq 0 ] && [ "$(stat -c %u "$repo_dir/.git")" -eq 0 ] || fail '项目仓库或其 .git 目录不属于 root，已拒绝更新。'
fi
origin="$(git -c safe.directory="$repo_dir" -C "$repo_dir" config --get remote.origin.url)" || fail '无法确认仓库来源。'
case "$origin" in
  https://github.com/hikling/shendu-v1|https://github.com/hikling/shendu-v1.git|git@github.com:hikling/shendu-v1.git) ;;
  *) fail '项目来源必须为 hikling/shendu-v1。' ;;
esac
if [ -d "$app_dir/.host-runtime/.update.lock" ] || [ -d "$app_dir/tmp/.update.lock" ]; then
  fail '检测到另一个安装或更新任务正在运行；请等待结束后重试。'
fi
command -v docker >/dev/null 2>&1 || fail '没有找到 Docker。'
docker_root="$(docker info --format '{{.DockerRootDir}}')" || fail '无法连接 Docker。'
[ -d "$docker_root" ] || fail '无法检查 Docker 存储目录。'

echo '整理慎独旧镜像缓存，保留最新两份及容器引用的镜像……'
images="$(docker image ls --filter 'reference=shendu-deploy:*' --format '{{.Repository}}:{{.Tag}}')" || fail '无法读取镜像列表。'
kept=0
printf '%s\n' "$images" | while IFS= read -r image; do
  case "$image" in
    shendu-deploy:*-amd64|shendu-deploy:*-arm64) ;;
    *) continue ;;
  esac
  tree="${image#shendu-deploy:}"
  tree="${tree%-*}"
  [ "${#tree}" -eq 40 ] || continue
  case "$tree" in *[!0-9a-f]*) continue ;; esac
  kept="$((kept + 1))"
  [ "$kept" -gt 2 ] || continue
  references="$(docker ps -aq --filter "ancestor=$image")" || fail '无法检查镜像的容器引用。'
  [ -z "$references" ] || continue
  if ! docker image rm "$image"; then
    printf '镜像暂未清理，继续核对实际可用空间：%s\n' "$image" >&2
  fi
done

check_space() {
  usage="$(LC_ALL=C df -Pk "$1")" || fail "无法读取目录可用空间：$1"
  available="$(printf '%s\n' "$usage" | awk 'NR==2 {print $4}')"
  case "$available" in ''|*[!0-9]*) fail "无法读取目录可用空间：$1" ;; esac
  if [ "$available" -lt 1048576 ]; then
    fail "目录 $1 可用空间不足 1 GiB。请先检查 df -h 和 docker system df，清理未使用缓存后重试。"
  fi
}
data_dir="$app_dir/data"
[ -d "$data_dir" ] || data_dir="$app_dir"
check_space "$app_dir"
check_space "$data_dir"
check_space "$docker_root"
SHENDU_BACKUP_BEFORE_UPDATE="${SHENDU_BACKUP_BEFORE_UPDATE:-n}" exec sh "$app_dir/scripts/update.sh" "$repo_dir"
