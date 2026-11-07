#!/usr/bin/env python3
"""Package committed Shendu source and verify its source-only handover archive."""

import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import tempfile
import zipfile


PREFIX = "shendu-v1/"
MANIFEST = "HANDOVER-MANIFEST.json"
MAX_FILE = 32 * 1024 * 1024
MAX_TOTAL = 512 * 1024 * 1024
FIXTURES = {"encrypted-v1.shendu", "stream-v2.shendu", "v2.shendu", "v3.shendu", "v4.shendu"}
SECRET_PATTERNS = (
    ("private key", re.compile(rb"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----")),
    ("API token", re.compile(rb"(?<![A-Za-z0-9])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}")),
    ("GitHub token", re.compile(rb"(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})")),
)


class PackageError(Exception):
    pass


def safe_path(name):
    if not isinstance(name, str):
        raise PackageError("Invalid archive path type")
    parts = PurePosixPath(name).parts
    if not parts or name.startswith("/") or any(c in name for c in '\\:\x00<>"|?*'):
        raise PackageError("Unsafe archive path")
    if any(p in {".", ".."} or not p or p != p.rstrip(". ") or p.startswith(" ") or any(ord(c) < 32 for c in p) for p in name.split("/")):
        raise PackageError("Unsafe archive path")
    reserved = {"con", "prn", "aux", "nul", *("com" + str(n) for n in range(1, 10)), *("lpt" + str(n) for n in range(1, 10))}
    if any(p.split(".")[0].lower() in reserved for p in parts):
        raise PackageError("Nonportable archive path")


def exclusion(name):
    safe_path(name)
    lower = name.lower()
    parts = lower.split("/")
    leaf = parts[-1]
    if any(p in {".aws", ".ssh", ".azure", ".docker", ".config"} for p in parts[:-1]) or leaf in {".npmrc", ".pypirc", ".netrc", ".git-credentials"}:
        return "local-credentials"
    if parts[0] in {".git", ".codex", ".claude", ".vscode", ".idea"}:
        return "local-platform-metadata"
    if parts[0] == ".trellis" and (len(parts) > 1 and (parts[1] in {"workspace", "tasks"} or parts[1].startswith("."))):
        return "development-history"
    if parts[0] == "docs" and any(p.endswith("-qa") for p in parts[1:-1]):
        return "historical-qa"
    # Accepted artwork masters are editable source, not temporary generator output.
    if parts[0] == "output" and not lower.startswith("output/imagegen/record-library/"):
        return "generated-output"
    if "node_modules" in parts or "__pycache__" in parts or lower.startswith("shendu/public/ui/"):
        return "rebuildable-dependencies"
    if any(p in {"data", "tmp", "backups", ".cache"} for p in parts[:-1]):
        if lower in {"shendu/data/.gitkeep", "shendu/tmp/.gitkeep"}:
            return None
        return "runtime-data"
    if (leaf == ".env" or leaf.startswith(".env.")) and lower != "shendu/.env.example":
        return "environment-config"
    if leaf in {"backup-master.key", "server-backup.password", "compose.override.yaml", "compose.override.yml", ".ds_store"} or leaf.startswith(".deploy-image.override."):
        return "runtime-config"
    if leaf.endswith((".db", ".db-wal", ".db-shm", ".sqlite", ".sqlite3", ".sqlite-wal", ".sqlite-shm", ".shendu-site", ".shendu-db", ".shendu-migration", ".pem", ".key", ".p12", ".pfx", ".log", ".zip", ".pyc")):
        return "private-or-generated-file"
    if leaf.endswith(".shendu") and lower not in {"shendu/tests/fixtures/personal/" + f for f in FIXTURES}:
        return "personal-backup"
    return None


def git(repo, *args):
    return subprocess.run(["git", "-c", "safe.directory=" + str(repo), "-C", str(repo), *args], check=True, capture_output=True).stdout


def digest_file(path):
    with Path(path).open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def read_checksum(path):
    if path.stat().st_size > 1024:
        raise PackageError("Oversized ZIP checksum sidecar")
    try:
        return path.read_text(encoding="ascii")
    except UnicodeDecodeError as error:
        raise PackageError("Invalid ZIP checksum sidecar") from error


def verify_archive(path, check_sidecar=True):
    path = Path(path)
    sidecar = Path(str(path) + ".sha256")
    if path.is_symlink() or sidecar.is_symlink():
        raise PackageError("Linked archive or checksum is not supported")
    if check_sidecar:
        if not sidecar.is_file():
            raise PackageError("Missing ZIP checksum sidecar")
        expected = digest_file(path) + "  " + path.name + "\n"
        if read_checksum(sidecar) != expected:
            raise PackageError("ZIP checksum does not match its sidecar")
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or len({n.casefold() for n in names}) != len(names):
            raise PackageError("Duplicate archive path")
        for item in archive.infolist():
            if not item.filename.startswith(PREFIX):
                raise PackageError("Unexpected archive root")
            safe_path(item.filename[len(PREFIX):])
            if not stat.S_ISREG(item.external_attr >> 16) or item.file_size > MAX_FILE:
                raise PackageError("Unsupported archive entry")
        if sum(i.file_size for i in archive.infolist()) > MAX_TOTAL:
            raise PackageError("Archive exceeds source package limit")
        if PREFIX + MANIFEST not in names:
            raise PackageError("Missing source manifest")
        manifest_info = archive.getinfo(PREFIX + MANIFEST)
        if manifest_info.file_size > 2 * 1024 * 1024:
            raise PackageError("Oversized manifest")
        try:
            manifest = json.loads(archive.read(manifest_info))
        except (ValueError, UnicodeDecodeError) as error:
            raise PackageError("Invalid source manifest JSON") from error
        if not isinstance(manifest, dict) or type(manifest.get("format_version")) is not int or manifest["format_version"] != 1:
            raise PackageError("Invalid source manifest")
        if not all(isinstance(manifest.get(k), str) and re.fullmatch(r"[0-9a-f]{40}", manifest[k]) for k in ("source_commit", "application_tree")):
            raise PackageError("Invalid source manifest")
        entries = manifest.get("files")
        if not isinstance(entries, list):
            raise PackageError("Missing source file list")
        wanted = {PREFIX + MANIFEST}
        for entry in entries:
            if not isinstance(entry, dict) or not {"path", "size", "mode", "sha256"} <= entry.keys():
                raise PackageError("Invalid source file entry")
            name = entry["path"]
            if (type(entry["size"]) is not int or not 0 <= entry["size"] <= MAX_FILE
                    or not isinstance(entry["mode"], str) or entry["mode"] not in {"100644", "100755"}
                    or not isinstance(entry["sha256"], str)
                    or not re.fullmatch(r"[0-9a-f]{64}", entry["sha256"])):
                raise PackageError("Invalid source metadata")
            if exclusion(name) or name == MANIFEST or PREFIX + name in wanted:
                raise PackageError("Disallowed or duplicate source entry")
            wanted.add(PREFIX + name)
            if PREFIX + name not in names:
                raise PackageError("Missing source file: " + name)
            info = archive.getinfo(PREFIX + name)
            if info.file_size != entry["size"] or (info.external_attr >> 16) != int(entry["mode"], 8):
                raise PackageError("Source metadata mismatch: " + name)
            with archive.open(info) as source:
                actual = hashlib.file_digest(source, "sha256").hexdigest()
            if actual != entry["sha256"]:
                raise PackageError("Source checksum mismatch: " + name)
        if set(names) != wanted:
            raise PackageError("Unlisted archive contents")
    return manifest


def build_archive(repo, output_dir):
    repo = Path(repo).resolve()
    output_dir = Path(output_dir).resolve()
    if output_dir == repo or repo in output_dir.parents:
        raise PackageError("Output directory must be outside the source checkout")
    if git(repo, "status", "--porcelain", "--untracked-files=no").strip():
        raise PackageError("Commit tracked changes before packaging; untracked files are never included")
    commit = git(repo, "rev-parse", "HEAD").decode().strip()
    tree = git(repo, "rev-parse", commit + ":shendu").decode().strip()
    manifest = {"format_version": 1, "source_commit": commit, "application_tree": tree,
                "repository": "https://github.com/hikling/shendu-v1", "files": [], "excluded_categories": {}}
    selected, omitted, portable_names = [], Counter(), set()
    for row in git(repo, "ls-tree", "-r", "-z", commit).split(b"\0"):
        if not row:
            continue
        metadata, raw_name = row.split(b"\t", 1)
        mode, kind, oid = metadata.decode().split()
        name = raw_name.decode("utf-8")
        reason = exclusion(name)
        if reason:
            omitted[reason] += 1
            continue
        if kind != "blob" or mode not in {"100644", "100755"} or name == MANIFEST:
            raise PackageError("Unsupported Git source entry: " + name)
        if name.casefold() in portable_names:
            raise PackageError("Case-insensitive source path collision")
        portable_names.add(name.casefold())
        selected.append((name, mode, oid))
    manifest["excluded_categories"] = dict(sorted(omitted.items()))
    output_dir.mkdir(parents=True, exist_ok=True)
    archive_path = output_dir / ("shendu-v1-handover-" + commit[:12] + ".zip")
    temporary = tempfile.NamedTemporaryFile(prefix=".handover-", suffix=".zip", dir=output_dir, delete=False)
    temporary.close()
    temporary_path = Path(temporary.name)
    try:
        with zipfile.ZipFile(temporary_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            with subprocess.Popen(["git", "-c", "safe.directory=" + str(repo), "-C", str(repo), "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE) as blobs:
                try:
                    total = 0
                    for name, mode, oid in selected:
                        blobs.stdin.write((oid + "\n").encode()); blobs.stdin.flush()
                        header = blobs.stdout.readline().split()
                        if len(header) != 3 or header[1] != b"blob":
                            raise PackageError("Unable to read committed blob")
                        size = int(header[2]); total += size
                        if size > MAX_FILE or total > MAX_TOTAL:
                            raise PackageError("Source exceeds package size limit")
                        content = blobs.stdout.read(size)
                        if len(content) != size or blobs.stdout.read(1) != b"\n":
                            raise PackageError("Incomplete committed blob")
                        if any(pattern.search(content) for _, pattern in SECRET_PATTERNS):
                            raise PackageError("Possible credential in committed source: " + name)
                        info = zipfile.ZipInfo(PREFIX + name, date_time=(2020, 1, 1, 0, 0, 0))
                        info.create_system = 3; info.external_attr = int(mode, 8) << 16
                        archive.writestr(info, content, compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
                        manifest["files"].append({"path": name, "size": size, "mode": mode, "sha256": hashlib.sha256(content).hexdigest()})
                finally:
                    blobs.stdin.close()
                    blobs.stdout.close()
                if blobs.wait() != 0:
                    raise PackageError("Git blob reader failed")
            info = zipfile.ZipInfo(PREFIX + MANIFEST, date_time=(2020, 1, 1, 0, 0, 0))
            info.create_system = 3; info.external_attr = 0o100644 << 16
            archive.writestr(info, json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"), compress_type=zipfile.ZIP_DEFLATED)
        verify_archive(temporary_path, check_sidecar=False)
        checksum = digest_file(temporary_path)
        checksum_path = Path(str(archive_path) + ".sha256")
        expected = checksum + "  " + archive_path.name + "\n"
        if archive_path.is_symlink() or checksum_path.is_symlink():
            raise PackageError("Refusing linked output paths")
        if checksum_path.exists() and read_checksum(checksum_path) != expected:
            raise PackageError("Refusing to replace a different checksum file")
        if archive_path.exists():
            if digest_file(archive_path) != checksum:
                raise PackageError("Refusing to replace a different archive")
        else:
            os.link(temporary_path, archive_path)
        with tempfile.NamedTemporaryFile(prefix=".handover-", dir=output_dir, delete=False) as staged_checksum:
            staged_checksum.write(expected.encode("ascii"))
        checksum_temp = Path(staged_checksum.name)
        try:
            try:
                os.link(checksum_temp, checksum_path)
            except FileExistsError:
                if checksum_path.is_symlink() or read_checksum(checksum_path) != expected:
                    raise PackageError("Checksum file changed during publication")
        finally:
            checksum_temp.unlink(missing_ok=True)
        verify_archive(archive_path)
        return archive_path, checksum_path, manifest
    finally:
        temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[2] / "交接包")
    parser.add_argument("--verify", type=Path, help="verify an existing ZIP without requiring Git")
    args = parser.parse_args()
    try:
        if args.verify:
            manifest = verify_archive(args.verify)
            print("Verified", len(manifest["files"]), "source files; commit", manifest["source_commit"])
        else:
            archive, checksum, manifest = build_archive(Path(__file__).resolve().parents[1], args.output_dir)
            print("ZIP:", archive); print("SHA256:", checksum)
            print("Verified", len(manifest["files"]), "source files; commit", manifest["source_commit"])
    except (PackageError, OSError, ValueError, KeyError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        parser.exit(1, "Packaging failed: " + str(error) + "\n")


if __name__ == "__main__":
    main()
