"""Exercise the real root launcher with isolated Docker, disk and updater commands."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def find_shell():
    shell = shutil.which("sh")
    if shell:
        return Path(shell)
    git = shutil.which("git")
    if git:
        candidate = Path(git).parent.parent / "usr/bin/sh.exe"
        if candidate.is_file():
            return candidate
    raise RuntimeError("A POSIX shell is required for update launcher tests")


class UpdateLauncherTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="shendu-launcher-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repo = self.root / "checkout with spaces"
        self.bin = self.root / "bin"
        self.log = self.root / "commands.log"
        self.bin.mkdir()
        (self.root / "docker").mkdir()
        (self.repo / ".git").mkdir(parents=True)
        (self.repo / "shendu/data").mkdir(parents=True)
        (self.repo / "shendu/scripts").mkdir()
        shutil.copyfile(ROOT / "update.sh", self.repo / "update.sh")
        self.shell = find_shell()
        self.env = {
            **os.environ,
            "PATH": os.pathsep.join([str(self.bin), str(self.shell.parent), os.environ.get("PATH", "")]),
            "QA_LOG": self.log.as_posix(),
            "QA_DOCKER_ROOT": (self.root / "docker").as_posix(),
            "QA_IMAGES": "",
        }
        self.env.pop("SHENDU_BACKUP_BEFORE_UPDATE", None)
        self.command("id", 'printf "%s\\n" "${QA_UID:-0}"')
        self.command("git", 'printf "%s\\n" "${QA_ORIGIN:-https://github.com/hikling/shendu-v1.git}"')
        self.command("df", '''
            [ "${QA_DF_FAIL:-0}" != 1 ] || exit 1
            available="${QA_DATA_FREE:-2097152}"
            case "$2" in */docker) available="${QA_DOCKER_FREE:-2097152}" ;; esac
            printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\\n'
            printf 'fixture 8388608 1 %s 1%% /fixture\\n' "$available"
        ''')
        self.command("docker", '''
            printf 'docker %s\\n' "$*" >> "$QA_LOG"
            case "$1 $2" in
              'info --format') printf '%s\\n' "$QA_DOCKER_ROOT" ;;
              'image ls')
                [ "${QA_LIST_FAIL:-0}" != 1 ] || exit 1
                printf '%s\\n' "$QA_IMAGES" ;;
              'ps -aq')
                [ "${QA_REFERENCE_FAIL:-0}" != 1 ] || exit 1
                case "$*" in *"ancestor=${QA_IN_USE:-none}"*) printf 'existing-container\\n' ;; esac ;;
              'image rm') [ "${QA_REMOVE_FAIL:-0}" != 1 ] ;;
              *) exit 2 ;;
            esac
        ''')
        updater = self.repo / "shendu/scripts/update.sh"
        updater.write_text('printf "updater %s %s\\n" "$SHENDU_BACKUP_BEFORE_UPDATE" "$1" >> "$QA_LOG"\nexit "${QA_UPDATER_EXIT:-0}"\n', encoding="utf-8")

    def command(self, name, script):
        path = self.bin / name
        path.write_text("#!/bin/sh\n" + script + "\n", encoding="utf-8", newline="\n")
        path.chmod(0o755)

    def run_launcher(self, **environment):
        result = subprocess.run(
            [str(self.shell), (self.repo / "update.sh").as_posix()],
            cwd=self.root, env={**self.env, **environment}, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=20,
        )
        commands = self.log.read_text(encoding="utf-8") if self.log.exists() else ""
        return result, commands

    @staticmethod
    def image(number):
        return f"shendu-deploy:{number:040x}-amd64"

    def test_normal_update_derives_directory_and_forwards_backup_choice(self):
        for choice in (None, "y"):
            with self.subTest(choice=choice):
                result, commands = self.run_launcher(**({} if choice is None else {"SHENDU_BACKUP_BEFORE_UPDATE": choice}))
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"updater {choice or 'n'} ", commands)
                self.assertIn("checkout with spaces", commands)

    def test_only_old_shendu_cache_is_removed_and_used_images_are_kept(self):
        images = [self.image(index) for index in range(5)]
        result, commands = self.run_launcher(QA_IMAGES="\n".join([*images, "other:old", "shendu-deploy:custom-amd64"]), QA_IN_USE=images[3])
        self.assertEqual(result.returncode, 0, result.stderr)
        removed = [line.removeprefix("docker image rm ") for line in commands.splitlines() if line.startswith("docker image rm ")]
        self.assertEqual(removed, [images[2], images[4]])
        self.assertNotIn("--force", commands)
        self.assertNotIn("prune", commands)

    def test_low_data_or_docker_space_stops_before_the_updater(self):
        for key in ("QA_DATA_FREE", "QA_DOCKER_FREE"):
            for available in ("0", "1048575"):
                with self.subTest(filesystem=key, available=available):
                    result, commands = self.run_launcher(**{key: available})
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("1 GiB", result.stderr)
                    self.assertNotIn("updater ", commands)

    def test_exact_space_threshold_is_accepted(self):
        result, commands = self.run_launcher(QA_DATA_FREE="1048576", QA_DOCKER_FREE="1048576")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("updater n ", commands)

    def test_bad_disk_output_and_failed_commands_do_not_start_an_update(self):
        for variables in ({"QA_DATA_FREE": "invalid"}, {"QA_DF_FAIL": "1"}, {"QA_LIST_FAIL": "1"}, {"QA_REFERENCE_FAIL": "1", "QA_IMAGES": "\n".join(self.image(index) for index in range(3))}):
            with self.subTest(variables=variables):
                result, commands = self.run_launcher(**variables)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("updater ", commands)

    def test_failed_cache_removal_still_requires_sufficient_space(self):
        images = "\n".join(self.image(index) for index in range(3))
        result, commands = self.run_launcher(QA_IMAGES=images, QA_REMOVE_FAIL="1", QA_DATA_FREE="0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("docker image rm ", commands)
        self.assertNotIn("updater ", commands)

    def test_wrong_origin_and_non_root_do_not_touch_docker(self):
        for variables in ({"QA_ORIGIN": "https://github.com/other/repo.git"}, {"QA_UID": "1000"}):
            with self.subTest(variables=variables):
                result, commands = self.run_launcher(**variables)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(commands, "")

    def test_underlying_failure_is_reported(self):
        result, _ = self.run_launcher(QA_UPDATER_EXIT="7")
        self.assertEqual(result.returncode, 7)

    def test_active_update_lock_stops_before_image_pruning(self):
        (self.repo / "shendu/.host-runtime/.update.lock").mkdir(parents=True)
        images = "\n".join(self.image(index) for index in range(4))
        result, commands = self.run_launcher(QA_IMAGES=images)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(commands, "")


if __name__ == "__main__":
    unittest.main()
