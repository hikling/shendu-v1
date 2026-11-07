#!/usr/bin/env python3
"""Create or verify a tiny handover bundle linking to the Shendu GitHub project."""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile


REPOSITORY = "https://github.com/hikling/shendu-v1"
PREFIX = "shendu-v1-handover/"
MANIFEST = "HANDOVER-MANIFEST.json"
DOCUMENTS = {"README.md", "VERSION.json"}
MAX_SIZE = 20 * 1024
MODE = 0o100644


class PackageError(Exception):
    pass


def git(repo, *args):
    return subprocess.run(["git", "-c", "safe.directory=" + str(repo), "-C", str(repo), *args],
                          check=True, capture_output=True).stdout


def digest_file(path):
    with Path(path).open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def document_links(commit):
    return {"latest": REPOSITORY + "/tree/main", "source": REPOSITORY + "/tree/" + commit,
            "readme": REPOSITORY + "/blob/" + commit + "/README.md",
            "handbook": REPOSITORY + "/blob/" + commit + "/HANDOVER.md",
            "deployment": REPOSITORY + "/blob/" + commit + "/docs/deployment.md"}


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def make_documents(commit, tree):
    metadata = {"package_type": "github-links", "repository": REPOSITORY,
                "source_commit": commit, "application_tree": tree, "links": document_links(commit)}
    links = metadata["links"]
    readme = f"""# 慎独 · 项目交接入口

源码、插画、测试和完整文档统一在 [GitHub 项目]({REPOSITORY}) 维护。本包只包含链接和版本信息，不含源码、图片、配置或站点数据。

- [最新 main]({links['latest']}) · [本次交接版本]({links['source']})
- [项目说明与本地运行]({links['readme']})
- [接手手册]({links['handbook']})
- [服务器部署、更新与备份]({links['deployment']})

## 获取最新代码

```sh
git clone --depth 1 --branch main {REPOSITORY}.git
cd shendu-v1/shendu
npm ci
npm start
```

本地需要 Node.js22.13+，推荐24；打开 http://localhost:3000。正式服务器部署按上方部署指南操作。

准确提交：`{commit}`。需要复现交接状态时使用“本次交接版本”链接，最新 main 可能继续更新。
"""
    files = {"README.md": readme.encode("utf-8"), "VERSION.json": json_bytes(metadata)}
    manifest = {"format_version": 2, **{key: metadata[key] for key in
                ("package_type", "repository", "source_commit", "application_tree")},
                "files": [{"path": name, "size": len(content), "mode": "100644",
                           "sha256": hashlib.sha256(content).hexdigest()}
                          for name, content in sorted(files.items())]}
    return files, manifest


def _verify_bytes(content):
    if len(content) >= MAX_SIZE:
        raise PackageError("Handover ZIP exceeds 20KiB")
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            infos = archive.infolist()
            if len(infos) != 3 or {item.filename for item in infos} != {PREFIX + name for name in DOCUMENTS | {MANIFEST}}:
                raise PackageError("Expected only README, version and manifest")
            if sum(item.file_size for item in infos) >= MAX_SIZE or any(
                    item.file_size < 0 or (item.external_attr >> 16) != MODE or item.flag_bits & 1 for item in infos):
                raise PackageError("Unsupported or oversized handover entry")
            manifest = json.loads(archive.read(PREFIX + MANIFEST))
            version = json.loads(archive.read(PREFIX + "VERSION.json"))
            if not isinstance(manifest, dict) or not isinstance(version, dict):
                raise PackageError("Invalid handover metadata")
            if type(manifest.get("format_version")) is not int or manifest["format_version"] != 2:
                raise PackageError("Unsupported handover format")
            for key in ("source_commit", "application_tree"):
                if not isinstance(version.get(key), str) or not re.fullmatch(r"[0-9a-f]{40}", version[key]):
                    raise PackageError("Invalid source identity")
            if version.get("repository") != REPOSITORY or version.get("package_type") != "github-links" or version.get("links") != document_links(version["source_commit"]):
                raise PackageError("Invalid GitHub project links")
            if any(manifest.get(key) != version[key] for key in
                   ("source_commit", "application_tree", "repository", "package_type")):
                raise PackageError("Inconsistent handover identity")
            entries = manifest.get("files")
            if not isinstance(entries, list) or len(entries) != 2:
                raise PackageError("Invalid document manifest")
            seen = set()
            for entry in entries:
                if not isinstance(entry, dict) or not isinstance(entry.get("path"), str) or entry["path"] not in DOCUMENTS or entry["path"] in seen:
                    raise PackageError("Unexpected or duplicate document")
                seen.add(entry["path"])
                payload = archive.read(PREFIX + entry["path"])
                if (type(entry.get("size")) is not int or entry["size"] != len(payload) or not payload
                        or entry.get("mode") != "100644" or entry.get("sha256") != hashlib.sha256(payload).hexdigest()):
                    raise PackageError("Document integrity mismatch")
            return manifest
    except (zipfile.BadZipFile, ValueError, UnicodeDecodeError) as error:
        raise PackageError("Invalid handover archive") from error


def verify_archive(path, check_sidecar=True):
    path = Path(path)
    sidecar = Path(str(path) + ".sha256")
    if path.is_symlink() or sidecar.is_symlink():
        raise PackageError("Linked archive or checksum is not supported")
    if path.stat().st_size >= MAX_SIZE:
        raise PackageError("Handover ZIP exceeds 20KiB")
    if check_sidecar:
        if not sidecar.is_file() or sidecar.stat().st_size > 1024:
            raise PackageError("Missing or oversized ZIP checksum")
        expected = digest_file(path) + "  " + path.name + "\n"
        if sidecar.read_bytes() != expected.encode("ascii"):
            raise PackageError("ZIP checksum mismatch")
    return _verify_bytes(path.read_bytes())


def _check_existing(path, content):
    if path.is_symlink():
        raise PackageError("Refusing linked output paths")
    if path.exists() and (path.stat().st_size != len(content) or path.read_bytes() != content):
        raise PackageError("Refusing to replace a different output: " + path.name)


def _publish(path, content):
    handle = tempfile.NamedTemporaryFile(prefix=".handover-", dir=path.parent, delete=False)
    temporary = Path(handle.name)
    try:
        with handle:
            handle.write(content)
        try:
            os.link(temporary, path)
        except FileExistsError:
            _check_existing(path, content)
    finally:
        temporary.unlink(missing_ok=True)


def build_archive(repo, output_dir):
    repo, output_dir = Path(repo).resolve(), Path(output_dir).resolve()
    if output_dir == repo or repo in output_dir.parents:
        raise PackageError("Output directory must be outside the source checkout")
    if git(repo, "status", "--porcelain", "--untracked-files=no").strip():
        raise PackageError("Commit tracked changes before packaging")
    commit = git(repo, "rev-parse", "HEAD").decode().strip()
    tree = git(repo, "rev-parse", commit + ":shendu").decode().strip()
    files, manifest = make_documents(commit, tree)
    files[MANIFEST] = json_bytes(manifest)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(files.items()):
            info = zipfile.ZipInfo(PREFIX + name, date_time=(2020, 1, 1, 0, 0, 0))
            info.create_system, info.external_attr = 3, MODE << 16
            archive.writestr(info, content, compress_type=zipfile.ZIP_DEFLATED)
    content = buffer.getvalue()
    _verify_bytes(content)
    output_dir.mkdir(parents=True, exist_ok=True)
    archive_path = output_dir / ("shendu-v1-handover-" + commit[:12] + ".zip")
    checksum_path = Path(str(archive_path) + ".sha256")
    checksum = (hashlib.sha256(content).hexdigest() + "  " + archive_path.name + "\n").encode("ascii")
    for path, payload in ((archive_path, content), (checksum_path, checksum)):
        _check_existing(path, payload)
    _publish(archive_path, content)
    _publish(checksum_path, checksum)
    verify_archive(archive_path)
    return archive_path, checksum_path, manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[2] / "交接包")
    parser.add_argument("--verify", type=Path, help="verify an existing link bundle without Git")
    args = parser.parse_args()
    try:
        if args.verify:
            manifest = verify_archive(args.verify)
        else:
            archive, checksum, manifest = build_archive(Path(__file__).resolve().parents[1], args.output_dir)
            print("ZIP:", archive)
            print("SHA256:", checksum)
        print("Verified GitHub link bundle; commit", manifest["source_commit"])
    except (PackageError, OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, "Packaging failed: " + str(error) + "\n")


if __name__ == "__main__":
    main()
