"""Test tiny GitHub-link handovers using synthetic repositories and ZIPs only."""

import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/package-handover.py"
SPEC = importlib.util.spec_from_file_location("package_handover", SCRIPT)
PACKAGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGE)


@unittest.skipUnless(shutil.which("git"), "Git is required to generate a handover")
class HandoverPackageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="shendu-link-handover-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.repo, self.output = self.root / "source", self.root / "delivery"
        self.repo.mkdir()
        self.git("init", "--template=", "--initial-branch=main")
        self.git("config", "user.name", "Synthetic Test")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "core.autocrlf", "false")
        self.write("shendu/server.mjs", b"// synthetic server\n")
        self.write("README.md", b"# Not copied into the link bundle\n")
        self.commit()

    def git(self, *args):
        return subprocess.run(["git", "-c", "safe.directory=" + str(self.repo), "-C", str(self.repo), *args],
                              check=True, capture_output=True).stdout

    def write(self, name, content):
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def commit(self):
        self.git("add", "--all", "--force")
        self.git("commit", "--quiet", "-m", "Synthetic test source")

    def package(self):
        return PACKAGE.build_archive(self.repo, self.output)

    @staticmethod
    def checksum(path):
        Path(str(path) + ".sha256").write_bytes(
            (hashlib.sha256(path.read_bytes()).hexdigest() + "  " + path.name + "\n").encode("ascii"))

    def variant(self, name="modified.zip", *, changes=None, manifest=None, extra=(), update_hashes=False):
        original, _, _ = self.package()
        with zipfile.ZipFile(original) as archive:
            entries = [(info, archive.read(info)) for info in archive.infolist()]
        if update_hashes:
            manifest = json.loads(next(content for info, content in entries if info.filename == PACKAGE.PREFIX + PACKAGE.MANIFEST))
            for entry in manifest["files"]:
                payload = (changes or {}).get(PACKAGE.PREFIX + entry["path"])
                if payload is not None:
                    entry.update(size=len(payload), sha256=hashlib.sha256(payload).hexdigest())
        destination = self.output / name
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for info, content in entries:
                    if info.filename == PACKAGE.PREFIX + PACKAGE.MANIFEST and manifest is not None:
                        content = manifest if isinstance(manifest, bytes) else PACKAGE.json_bytes(manifest)
                    if changes and info.filename in changes:
                        content = changes[info.filename]
                    archive.writestr(info, content, compress_type=zipfile.ZIP_DEFLATED)
                for info, content in extra:
                    archive.writestr(info, content)
        self.checksum(destination)
        return destination

    def test_tiny_bundle_has_only_generated_links_and_exact_identity(self):
        archive, sidecar, manifest = self.package()
        self.assertLess(archive.stat().st_size, 20 * 1024)
        self.assertEqual(manifest["source_commit"], self.git("rev-parse", "HEAD").decode().strip())
        self.assertEqual(manifest["application_tree"], self.git("rev-parse", "HEAD:shendu").decode().strip())
        with zipfile.ZipFile(archive) as zipped:
            self.assertEqual(set(zipped.namelist()), {PACKAGE.PREFIX + name for name in
                             ("README.md", "VERSION.json", "HANDOVER-MANIFEST.json")})
            readme = zipped.read(PACKAGE.PREFIX + "README.md").decode()
            version = json.loads(zipped.read(PACKAGE.PREFIX + "VERSION.json"))
        self.assertIn("git clone --depth 1 --branch main " + PACKAGE.REPOSITORY + ".git", readme)
        self.assertNotIn("Not copied", readme)
        self.assertEqual(version["links"]["handbook"], PACKAGE.REPOSITORY + "/blob/" + manifest["source_commit"] + "/HANDOVER.md")
        self.assertEqual(sidecar.read_bytes(), (hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name + "\n").encode())
        self.assertEqual(PACKAGE.verify_archive(archive), manifest)

    def test_local_sources_art_and_credentials_never_enter_bundle(self):
        marker = b"SYNTHETIC_PRIVATE_CONTENT_MUST_NOT_BE_COPIED"
        for name in ("shendu/.env", "shendu/data/site.db", "shendu/data/backup-master.key",
                     "backups/personal.shendu", "output/imagegen/record-library/original.png"):
            self.write(name, marker + os.urandom(150000))
        self.commit()
        self.write("untracked-note.txt", marker)
        real_git = PACKAGE.git
        with patch.object(PACKAGE, "git", wraps=real_git) as commands:
            archive, _, _ = self.package()
        self.assertEqual(len(commands.call_args_list), 3)
        self.assertFalse(any(arg in {"ls-tree", "cat-file", "show"}
                             for call in commands.call_args_list for arg in call.args[1:]))
        with zipfile.ZipFile(archive) as zipped:
            self.assertTrue(all(marker not in zipped.read(info) for info in zipped.infolist()))
        self.assertLess(archive.stat().st_size, 20 * 1024)

    def test_commit_capture_pins_tree_even_if_head_changes(self):
        initial = self.git("rev-parse", "HEAD").decode().strip()
        initial_tree = self.git("rev-parse", initial + ":shendu").decode().strip()
        self.write("shendu/server.mjs", b"// later version\n")
        self.commit()
        real_git = PACKAGE.git
        def captured(repo, *args):
            return (initial + "\n").encode() if args == ("rev-parse", "HEAD") else real_git(repo, *args)
        with patch.object(PACKAGE, "git", side_effect=captured):
            _, _, manifest = self.package()
        self.assertEqual(manifest["source_commit"], initial)
        self.assertEqual(manifest["application_tree"], initial_tree)

    def test_verify_needs_no_git_and_allows_future_readme_wording(self):
        path = self.variant(changes={PACKAGE.PREFIX + "README.md": b"# Updated receiving instructions\n"}, update_hashes=True)
        with patch.object(PACKAGE, "git", side_effect=AssertionError("Verification must not use Git")):
            self.assertEqual(PACKAGE.verify_archive(path)["package_type"], "github-links")

    def test_dirty_tracked_changes_and_inside_checkout_output_are_refused(self):
        self.write("README.md", b"Uncommitted\n")
        with self.assertRaises(PACKAGE.PackageError):
            self.package()
        self.git("add", "README.md")
        with self.assertRaises(PACKAGE.PackageError):
            self.package()
        with self.assertRaises(PACKAGE.PackageError):
            PACKAGE.build_archive(self.repo, self.repo / "delivery")

    def test_repeated_build_is_identical_without_replacing_outputs(self):
        archive, sidecar, _ = self.package()
        before = (archive.read_bytes(), archive.stat().st_mtime_ns, sidecar.stat().st_mtime_ns)
        self.package()
        self.assertEqual(before, (archive.read_bytes(), archive.stat().st_mtime_ns, sidecar.stat().st_mtime_ns))
        self.assertFalse(list(self.output.glob(".handover-*")))

    def test_failed_staging_write_removes_partial_temporary_file(self):
        self.output.mkdir()
        create_temporary = PACKAGE.tempfile.NamedTemporaryFile
        class FailedWrite:
            def __init__(self, *args, **kwargs):
                self.handle = create_temporary(*args, **kwargs)
                self.name = self.handle.name
            def __enter__(self):
                return self
            def __exit__(self, *args):
                self.handle.close()
            def write(self, content):
                self.handle.write(content[:1])
                raise OSError("Synthetic disk-full failure")
        with patch.object(PACKAGE.tempfile, "NamedTemporaryFile", FailedWrite):
            with self.assertRaises(OSError):
                PACKAGE._publish(self.output / "delivery.zip", b"synthetic output")
        self.assertEqual(list(self.output.iterdir()), [])

    def test_conflicting_archive_or_checksum_is_not_replaced(self):
        archive, sidecar, _ = self.package()
        archive.write_bytes(b"Unrelated existing archive")
        with self.assertRaises(PACKAGE.PackageError):
            self.package()
        self.assertEqual(archive.read_bytes(), b"Unrelated existing archive")
        archive.unlink()
        sidecar.write_bytes(b"Unrelated existing checksum")
        with self.assertRaises(PACKAGE.PackageError):
            self.package()
        self.assertFalse(archive.exists())
        self.assertEqual(sidecar.read_bytes(), b"Unrelated existing checksum")

    def test_missing_or_invalid_checksum_and_oversized_zip_are_refused(self):
        archive, sidecar, _ = self.package()
        for content in (None, b"incorrect", b"\xff\xfe", b"x" * 1025):
            with self.subTest(content=content):
                sidecar.unlink(missing_ok=True)
                if content is not None:
                    sidecar.write_bytes(content)
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(archive)
        PACKAGE.verify_archive(archive, check_sidecar=False)
        archive.write_bytes(b"0" * PACKAGE.MAX_SIZE)
        with self.assertRaises(PACKAGE.PackageError):
            PACKAGE.verify_archive(archive, check_sidecar=False)

    def test_tampered_documents_and_expanded_size_limit_are_checked(self):
        for payload in (b"Tampered instructions", b"x" * PACKAGE.MAX_SIZE):
            with self.subTest(size=len(payload)):
                path = self.variant(changes={PACKAGE.PREFIX + "README.md": payload})
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(path)

    def test_extras_duplicates_and_traversal_cannot_be_added(self):
        for name in (PACKAGE.PREFIX + "extra.png", PACKAGE.PREFIX + "README.md", "../escape", PACKAGE.PREFIX + "../escape"):
            with self.subTest(name=name):
                path = self.variant(extra=[(name, b"extra")])
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(path)

    def test_invalid_manifest_and_version_contract_are_refused(self):
        _, _, manifest = self.package()
        for value in (b"{bad JSON", [], None, {**manifest, "format_version": True},
                      {**manifest, "format_version": 1}, {**manifest, "files": []},
                      {**manifest, "files": [None, None]}, {**manifest, "source_commit": "0" * 40}):
            with self.subTest(value=value):
                encoded = PACKAGE.json_bytes(value) if value is None else value
                path = self.variant(manifest=encoded)
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(path)
        archive, _, _ = self.package()
        with zipfile.ZipFile(archive) as zipped:
            version = json.loads(zipped.read(PACKAGE.PREFIX + "VERSION.json"))
        for key, value in (("repository", "https://example.invalid/project"), ("source_commit", None),
                           ("application_tree", "invalid"), ("links", {}), ("package_type", "source")):
            changed = {**version, key: value}
            path = self.variant(changes={PACKAGE.PREFIX + "VERSION.json": PACKAGE.json_bytes(changed)}, update_hashes=True)
            with self.assertRaises(PACKAGE.PackageError):
                PACKAGE.verify_archive(path)

    def test_manifest_file_metadata_is_checked(self):
        _, _, base = self.package()
        for key, value in (("path", "../escape"), ("path", ["README.md"]), ("size", True),
                           ("size", -1), ("mode", "100755"), ("sha256", "wrong")):
            changed = copy.deepcopy(base)
            changed["files"][0][key] = value
            with self.subTest(key=key, value=value):
                path = self.variant(manifest=changed)
                with self.assertRaises(PACKAGE.PackageError):
                    PACKAGE.verify_archive(path)


if __name__ == "__main__":
    unittest.main()
