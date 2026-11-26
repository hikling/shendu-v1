#!/bin/sh
set -eu
umask 077

data_dir="${SHENDU_DATA_DIR:-/app/data}"
tmp_dir="${SHENDU_TMP_DIR:-/app/tmp}"

mkdir -p "$data_dir" "$tmp_dir"
chown node:node "$data_dir" "$tmp_dir"
for entry in "$data_dir"/* "$data_dir"/.[!.]* "$data_dir"/..?*; do
  [ -e "$entry" ] || [ -L "$entry" ] || continue
  case "${entry##*/}" in
    server-backup.password|server-backup.password.*) continue ;;
  esac
  chown -hR node:node "$entry"
done
for entry in "$tmp_dir"/* "$tmp_dir"/.[!.]* "$tmp_dir"/..?*; do
  [ -e "$entry" ] || [ -L "$entry" ] || continue
  chown -hR node:node "$entry"
done

exec su-exec node "$@"
