"""Exercise handover boundaries with isolated Git history and adversarial ZIPs.

No test reads a live database, environment file, personal backup or API key.
"""

from contextlib import redirect_stderr, redirect_stdout
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/package-handover.py"
SPEC = importlib.util.spec_from_file_location("package_handover", SCRIPT)
PACKAGE = importlib.util.module_from_spec(SPEC)
_write_bytecode = sys.dont_write_bytecode
sys.dont_write_bytecode = True
try:
    SPEC.loader.exec_module(PACKAGE)
finally:
    sys.dont_write_bytecode = _write_bytecode


@unittest.skipUnless(shutil.which("git"), "Git is required for source packaging")
class HandoverPackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="shendu-handover-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repo = self.root / "source"
        self.output = self.root / "delivery"
        self.repo.mkdir()
        self.git("init", "--template=", "--initial-branch=main")
        self.git("config", "user.name", "Synthetic Test")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "core.autocrlf", "false")
        self.git("config", "core.filemode", "false")
        self.sources = {
            "README.md": b"# Synthetic source handover\n",
            "shendu/server.mjs": b"console.log('synthetic server');\n",
            "shendu/package.json": b'{"name":"synthetic","private":true}\n',
            "shendu/package-lock.json": b'{"lockfileVersion":3}\n',
            "shendu/components.json": b"{}\n",
            "shendu/jsconfig.json": b"{}\n",
            "shendu/vite.config.js": b"export default {};\n",
            "shendu/ui/entry.jsx": b"export const synthetic = true;\n",
            "shendu/scripts/ui-licenses.mjs": b"export const synthetic = true;\n",
            "shendu/scripts/install.sh": b"#!/bin/sh\nprintf '%s\\n' synthetic\n",
            "shendu/Dockerfile": b"FROM scratch\n",
            "shendu/compose.yaml": b"services: {}\n",
            "shendu/Caddyfile": b":3000 { respond synthetic }\n",
            "shendu/.env.example": b"SHENDU_DOMAIN=review.example.com\n",
            "shendu/public/index.html": b"<!doctype html><title>Synthetic</title>\n",
        }
        for name, content in self.sources.items():
            self.write_source(name, content)
        self.commit()

    def git(self, *args):
        result = subprocess.run(
            ["git", "-c", "safe.directory=" + str(self.repo), "-C", str(self.repo), *args],
            check=True, capture_output=True,
            env={**os.environ, "GIT_AUTHOR_DATE": "2026-01-01T00:00:00+0000",
                 "GIT_COMMITTER_DATE": "2026-01-01T00:00:00+0000"},
        )
        return result.stdout

    def write_source(self, name, content):
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def commit(self):
        self.git("add", "--all", "--force")
        self.git("commit", "--quiet", "-m", "Synthetic fixture")

    def package(self):
        return PACKAGE.build_archive(self.repo, self.output)

    @staticmethod
    def sidecar(path):
        return Path(str(path) + ".sha256")

    def write_checksum(self, path):
        checksum = hashlib.sha256(path.read_bytes()).hexdigest()
        self.sidecar(path).write_text(checksum + "  " + path.name + "\n", encoding="ascii", newline="\n")

    def variant(self, name, *, manifest=None, changes=None, extra=()):
        """Recompute the outer checksum so tests reach the inner trust boundary."""
        if not hasattr(self, "original"):
            self.original, _, self.original_manifest = self.package()
        destination = self.output / name
        with zipfile.ZipFile(self.original) as archive:
            entries = [(entry, archive.read(entry)) for entry in archive.infolist()]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(destination, "w") as archive:
                for entry, content in entries:
                    if entry.filename == PACKAGE.PREFIX + PACKAGE.MANIFEST and manifest is not None:
                        content = manifest if isinstance(manifest, bytes) else json.dumps(manifest).encode("utf-8")
                    if changes and entry.filename in changes:
                        content = changes[entry.filename]
                    archive.writestr(entry, content)
                for entry, content in extra:
                    archive.writestr(entry, content)
        self.write_checksum(destination)
        return destination

    @staticmethod
    def entry(name, mode=0o100644):
        entry = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
        entry.create_system = 3
        entry.external_attr = mode << 16
        return entry

    def test_committed_bytes_and_identities_exclude_untracked_files(self):
        self.write_source("shendu/untracked.js", b"untracked local draft\n")
        self.write_source("shendu/.env", b"SYNTHETIC_ONLY=not-a-real-secret\n")
        archive_path, checksum_path, manifest = self.package()
        self.assertEqual(manifest["source_commit"], self.git("rev-parse", "HEAD").decode().strip())
        self.assertEqual(manifest["application_tree"], self.git("rev-parse", "HEAD:shendu").decode().strip())
        paths = {entry["path"] for entry in manifest["files"]}
        self.assertEqual(paths, set(self.sources))
        with zipfile.ZipFile(archive_path) as archive:
            for source in manifest["files"]:
                committed = self.git("show", "HEAD:" + source["path"])
                self.assertEqual(archive.read(PACKAGE.PREFIX + source["path"]), committed)
                self.assertEqual(source["sha256"], hashlib.sha256(committed).hexdigest())
                self.assertEqual(source["size"], len(committed))
        self.assertEqual(checksum_path.read_text(encoding="ascii"),
                         hashlib.sha256(archive_path.read_bytes()).hexdigest() + "  " + archive_path.name + "\n")
        self.assertEqual(PACKAGE.verify_archive(archive_path), manifest)

    def test_clean_crlf_checkout_packages_normalized_git_blob(self):
        self.write_source(".gitattributes", b"*.sh text eol=crlf\n")
        self.commit()
        name = "shendu/scripts/install.sh"
        committed = self.git("show", "HEAD:" + name)
        checkout = committed.replace(b"\n", b"\r\n")
        self.write_source(name, checkout)
        # Refresh Git's cached stat after the synthetic checkout conversion.
        # The normalizing add must not stage any change to the committed bytes.
        self.git("add", "--", name)
        self.git("diff", "--cached", "--quiet")
        self.assertNotEqual(committed, checkout)
        self.assertFalse(self.git("status", "--porcelain", "--untracked-files=no").strip())
        archive_path, _, _ = self.package()
        with zipfile.ZipFile(archive_path) as archive:
            self.assertEqual(archive.read(PACKAGE.PREFIX + name), committed)

    def test_commit_identity_stays_consistent_when_head_changes_during_packaging(self):
        initial = self.git("rev-parse", "HEAD").decode().strip()
        initial_tree = self.git("rev-parse", initial + ":shendu").decode().strip()
        self.write_source("README.md", b"A later commit must not leak into the initial package\n")
        self.write_source("shendu/server.mjs", b"console.log('later version');\n")
        self.write_source("shendu/later.js", b"Later commit only\n")
        self.commit()
        later = self.git("rev-parse", "HEAD").decode().strip()
        self.git("checkout", "--detach", initial)
        original_git = PACKAGE.git
        changed_head = False

        def move_head_after_identity(repo, *args):
            nonlocal changed_head
            result = original_git(repo, *args)
            if args == ("rev-parse", "HEAD") and not changed_head:
                self.git("checkout", "--detach", later)
                changed_head = True
            return result

        with patch.object(PACKAGE, "git", side_effect=move_head_after_identity):
            archive_path, _, manifest = self.package()
        self.assertTrue(changed_head)
        self.assertEqual(manifest["source_commit"], initial)
        self.assertEqual(manifest["application_tree"], initial_tree)
        self.assertNotIn("shendu/later.js", {entry["path"] for entry in manifest["files"]})
        with zipfile.ZipFile(archive_path) as archive:
            self.assertEqual(archive.read(PACKAGE.PREFIX + "README.md"), self.sources["README.md"])
            self.assertEqual(archive.read(PACKAGE.PREFIX + "shendu/server.mjs"), self.sources["shendu/server.mjs"])

    def test_git_executable_mode_is_preserved(self):
        name = "shendu/scripts/install.sh"
        self.git("update-index", "--chmod=+x", name)
        self.git("commit", "--quiet", "-m", "Synthetic executable mode")
        archive_path, _, manifest = self.package()
        source = next(entry for entry in manifest["files"] if entry["path"] == name)
        self.assertEqual(source["mode"], "100755")
        with zipfile.ZipFile(archive_path) as archive:
            self.assertEqual(archive.getinfo(PACKAGE.PREFIX + name).external_attr >> 16, 0o100755)

    def test_tracked_private_files_excluded_but_editable_sources_and_fixtures_retained(self):
        excluded = [
            ".codex/sessions/local.json", ".trellis/workspace/test/journal.md",
            ".trellis/tasks/old/prd.md", ".trellis/.developer", "docs/old-qa/screenshot.png",
            "output/rejected.png", "node_modules/dependency/index.js", "shendu/public/ui/shadcn.js",
            "shendu/data/shendu.db", "shendu/data/backup-master.key", "shendu/tmp/upload.bin",
            "shendu/backups/site.shendu-db", "shendu/.env", "shendu/.env.production",
            "shendu/compose.override.yaml", "shendu/.deploy-image.override.local",
            "personal.shendu", "migration.shendu-migration", "snapshot.shendu-site",
            "notes.sqlite3", "certificate.pem", "runtime.log", "archive.zip",
            ".aws/credentials", ".ssh/id_rsa", ".azure/accessTokens.json", ".docker/config.json",
            ".config/tool/credentials", ".npmrc", ".pypirc", ".netrc", ".git-credentials",
            "shendu/tests/fixtures/personal/nested/v4.shendu",
            "shendu/tests/fixtures/personal/real-user.shendu",
        ]
        retained = [
            "shendu/data/.gitkeep", "shendu/tmp/.gitkeep", ".trellis/spec/backend/index.md",
            ".trellis/scripts/task.py", ".github/workflows/verify.yml", ".gitattributes",
            "art/record-library/generation-plan.json",
            "output/imagegen/record-library/daily-source.png",
            "output/imagegen/record-library/contact-daily.png",
            "output/imagegen/record-library/gallery.html", "shendu/public/assets/records/daily.webp",
            "docs/deployment.md",
            *["shendu/tests/fixtures/personal/" + name for name in
              ("encrypted-v1.shendu", "stream-v2.shendu", "v2.shendu", "v3.shendu", "v4.shendu")],
        ]
        for name in excluded + retained:
            self.write_source(name, b"Synthetic test bytes only\n")
        self.commit()
        archive_path, _, manifest = self.package()
        paths = {entry["path"] for entry in manifest["files"]}
        self.assertTrue(set(retained).issubset(paths))
        self.assertFalse(set(excluded) & paths)
        self.assertTrue(set(self.sources).issubset(paths))
        self.assertEqual(sum(manifest["excluded_categories"].values()), len(excluded))
        self.assertEqual(PACKAGE.verify_archive(archive_path), manifest)

    def test_unstaged_and_staged_changes_are_refused(self):
        for staged in (False, True):
            with self.subTest(staged=staged):
                self.write_source("README.md", b"Changed tracked content\n")
                if staged:
                    self.git("add", "README.md")
                with self.assertRaises(PACKAGE.PackageError):
                    self.package()
                self.assertFalse(self.output.exists())
                self.git("reset", "--hard", "HEAD")

    def test_output_cannot_be_written_into_source_checkout(self):
        for output in (self.repo, self.repo / "delivery"):
            with self.subTest(output=output), self.assertRaises(PACKAGE.PackageError):
                PACKAGE.build_archive(self.repo, output)
        self.assertFalse((self.repo / "delivery").exists())

    def test_repeated_packaging_is_deterministic_and_does_not_replace_files(self):
        archive_path, checksum_path, manifest = self.package()
        before = (archive_path.read_bytes(), checksum_path.read_bytes(),
                  archive_path.stat().st_mtime_ns, checksum_path.stat().st_mtime_ns)
        again = self.package()
        self.assertEqual(again, (archive_path, checksum_path, manifest))
        self.assertEqual(before, (archive_path.read_bytes(), checksum_path.read_bytes(),
                                  archive_path.stat().st_mtime_ns, checksum_path.stat().st_mtime_ns))
        self.assertFalse(list(self.output.glob(".handover-*")))

    def test_different_existing_archive_is_never_clobbered(self):
        self.output.mkdir()
        commit = self.git("rev-parse", "HEAD").decode().strip()
        archive = self.output / ("shendu-v1-handover-" + commit[:12] + ".zip")
        archive.write_bytes(b"Existing delivery must remain untouched")
        before = archive.read_bytes()
        with self.assertRaises(PACKAGE.PackageError):
            self.package()
        self.assertEqual(archive.read_bytes(), before)
        self.assertFalse(self.sidecar(archive).exists())
        self.assertFalse(list(self.output.glob(".handover-*")))

    def test_different_existing_checksum_is_never_clobbered(self):
        self.output.mkdir()
        commit = self.git("rev-parse", "HEAD").decode().strip()
        archive = self.output / ("shendu-v1-handover-" + commit[:12] + ".zip")
        checksum = self.sidecar(archive)
        checksum.write_bytes(b"Existing checksum must remain untouched\n")
        with self.assertRaises(PACKAGE.PackageError):
            self.package()
        self.assertEqual(checksum.read_bytes(), b"Existing checksum must remain untouched\n")
        self.assertFalse(archive.exists())
        self.assertFalse(list(self.output.glob(".handover-*")))

    def test_linked_output_files_are_never_followed_or_replaced(self):
        archive, checksum, _ = self.package()
        target = self.root / "untouched-target"
        target.write_bytes(b"Synthetic linked target must remain untouched")
        for output in (archive, checksum):
            with self.subTest(output=output.name):
                original = output.read_bytes()
                output.unlink()
                try:
                    output.symlink_to(target)
                except OSError as error:
                    output.write_bytes(original)
                    self.skipTest("Host does not permit symbolic links: " + str(error))
                try:
                    with self.assertRaises(PACKAGE.PackageError):
                        self.package()
                    with self.assertRaises(PACKAGE.PackageError):
                        PACKAGE.verify_archive(archive)
                    self.assertTrue(output.is_symlink())
                    self.assertEqual(target.read_bytes(), b"Synthetic linked target must remain untouched")
                    self.assertFalse(list(self.output.glob(".handover-*")))
                finally:
                    output.unlink()
                    output.write_bytes(original)

    def test_source_size_limits_leave_no_publishable_or_temporary_archive(self):
        self.write_source("shendu/oversized.bin", b"0" * 256)
        self.commit()
        for max_file, max_total in ((128, 4096), (1024, 300)):
            with self.subTest(max_file=max_file, max_total=max_total):
                with patch.object(PACKAGE, "MAX_FILE", max_file), patch.object(PACKAGE, "MAX_TOTAL", max_total):
                    with self.assertRaises(PACKAGE.PackageError):
                        self.package()
                self.assertFalse(list(self.output.glob("*.zip")))
                self.assertFalse(list(self.output.glob("*.sha256")))
                self.assertFalse(list(self.output.glob(".handover-*")))

    def test_payload_tampering_is_detected_even_with_valid_outer_checksum(self):
        archive = self.variant("tampered.zip", changes={PACKAGE.PREFIX + "README.md": b"changed same archive\n"})
        with self.assertRaises(PACKAGE.PackageError):
            PACKAGE.verify_archive(archive)

    def test_extra_unlisted_file_is_rejected(self):
        archive = self.variant("extra.zip", extra=[(self.entry(PACKAGE.PREFIX + "unlisted.md"), b"unlisted")])
        with self.assertRaises(PACKAGE.PackageError):
            PACKAGE.verify_archive(archive)

    def test_duplicate_and_case_colliding_archive_paths_are_rejected(self):
        for index, name in enumerate(("README.md", "readme.MD")):
            with self.subTest(name=name):
                archive = self.variant(f"duplicate-{index}.zip", extra=[(self.entry(PACKAGE.PREFIX + name), b"collision")])
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(archive)

    def test_nonportable_and_traversal_paths_are_rejected(self):
        names = ["../escape", "nested/../../escape", "/absolute", "C:/absolute", "nested\\escape",
                 "nested//empty", "./dot", "trailing.", "trailing ", "NUL.txt", "control\x01name"]
        for index, name in enumerate(names):
            with self.subTest(name=name):
                archive = self.variant(f"path-{index}.zip", extra=[(self.entry(PACKAGE.PREFIX + name), b"unsafe")])
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(archive)

    def test_symlink_and_directory_archive_entries_are_rejected(self):
        for index, mode in enumerate((stat.S_IFLNK | 0o777, stat.S_IFDIR | 0o755)):
            with self.subTest(mode=mode):
                archive = self.variant(f"mode-{index}.zip", extra=[(self.entry(PACKAGE.PREFIX + "linked", mode), b"../target")])
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(archive)

    def test_malformed_top_level_manifest_is_a_controlled_rejection(self):
        for index, value in enumerate((None, [], "text", 1, True)):
            with self.subTest(value=value):
                archive = self.variant(f"manifest-type-{index}.zip", manifest=json.dumps(value).encode())
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(archive)
        archive = self.variant("manifest-json.zip", manifest=b"{not valid JSON")
        with self.assertRaises(PACKAGE.PackageError):
            PACKAGE.verify_archive(archive)

    def test_invalid_manifest_metadata_and_entry_shapes_are_rejected(self):
        self.original, _, base = self.package()
        variants = []
        for key, value in (("format_version", True), ("format_version", 2),
                           ("source_commit", None), ("source_commit", "not-a-commit"),
                           ("application_tree", 40), ("files", {}), ("files", None)):
            changed = copy.deepcopy(base)
            changed[key] = value
            variants.append(changed)
        for entry in (None, "text", {}, {"path": None}, {"path": ["README.md"]}):
            changed = copy.deepcopy(base)
            changed["files"][0] = entry
            variants.append(changed)
        for key, value in (("size", True), ("size", -1), ("size", "1"),
                           ("mode", "100666"), ("mode", None), ("sha256", "invalid"), ("sha256", None)):
            changed = copy.deepcopy(base)
            changed["files"][0][key] = value
            variants.append(changed)
        for index, manifest in enumerate(variants):
            with self.subTest(index=index):
                archive = self.variant(f"metadata-{index}.zip", manifest=manifest)
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(archive)

    def test_manifest_duplicate_missing_and_disallowed_source_entries_are_rejected(self):
        self.original, _, base = self.package()
        variants = []
        duplicate = copy.deepcopy(base)
        duplicate["files"].append(copy.deepcopy(duplicate["files"][0]))
        variants.append(duplicate)
        omitted = copy.deepcopy(base)
        omitted["files"].pop()
        variants.append(omitted)
        for name in ("missing.md", "../escape", "shendu/.env", PACKAGE.MANIFEST):
            missing = copy.deepcopy(base)
            missing["files"][0]["path"] = name
            variants.append(missing)
        for index, manifest in enumerate(variants):
            with self.subTest(index=index):
                archive = self.variant(f"membership-{index}.zip", manifest=manifest)
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(archive)

    def test_missing_wrong_or_malformed_sidecar_is_rejected(self):
        archive, checksum, manifest = self.package()
        checksum.unlink()
        with self.assertRaises(PACKAGE.PackageError):
            PACKAGE.verify_archive(archive)
        self.assertEqual(PACKAGE.verify_archive(archive, check_sidecar=False), manifest)
        invalid = (b"0" * 64 + b"  wrong-name.zip\n", b"not a checksum\n", b"\xff\xfe")
        for content in invalid:
            with self.subTest(content=content):
                checksum.write_bytes(content)
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(archive)

    def test_high_confidence_credentials_in_any_blob_are_rejected_without_disclosure(self):
        secrets = [b"sk-" + b"A" * 48, b"ghp_" + b"B" * 40,
                   b"-----BEGIN " + b"PRIVATE KEY-----\nSynthetic private material\n"]
        for index, secret in enumerate(secrets):
            with self.subTest(index=index):
                path = "shendu/opaque.asset"
                self.write_source(path, b"Synthetic test prefix\n" + secret)
                self.commit()
                stdout, stderr = io.StringIO(), io.StringIO()
                with redirect_stdout(stdout), redirect_stderr(stderr):
                    with self.assertRaises(PACKAGE.PackageError) as raised:
                        self.package()
                diagnostic = str(raised.exception) + stdout.getvalue() + stderr.getvalue()
                self.assertNotIn(secret.decode(), diagnostic)
                self.assertIn(path, diagnostic)
                self.assertFalse(list(self.output.glob("*.zip")))
                self.assertFalse(list(self.output.glob(".handover-*")))
                self.git("rm", "--", path)
                self.commit()


if __name__ == "__main__":
    unittest.main()
