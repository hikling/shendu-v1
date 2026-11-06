#!/usr/bin/env python3
"""Drive the real updater's stdin through a Linux PTY; no host commands are mocked here.

The shell harness supplies its isolated command PATH and synthetic deployment.
Each JSON item is sent after one [y/N] prompt; null sends canonical terminal EOF.
"""

import errno
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import termios
import time


def main():
    output_path, input_path, script_path, fixture_path = sys.argv[1:]
    responses = json.loads(Path(input_path).read_text(encoding="utf-8"))
    if not isinstance(responses, list) or not responses or any(
        response is not None and not isinstance(response, str) for response in responses
    ):
        raise ValueError("terminal inputs must be a nonempty list of strings or null")

    master, slave = os.openpty()
    attributes = termios.tcgetattr(slave)
    # Canonical input preserves actual read/EOF behavior. Disable CR translation
    # so the trailing-CR regression reaches read rather than being hidden by tty.
    attributes[0] &= ~(termios.ICRNL | termios.INLCR | termios.IGNCR)
    attributes[3] |= termios.ICANON
    attributes[3] &= ~(termios.ECHO | termios.ECHONL)
    termios.tcsetattr(slave, termios.TCSANOW, attributes)
    child = subprocess.Popen(
        ["/bin/sh", script_path, fixture_path],
        stdin=slave,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    os.close(slave)
    transcript = bytearray()
    sent = 0
    deadline = time.monotonic() + 20
    driver_error = None
    try:
        while True:
            if time.monotonic() >= deadline:
                raise TimeoutError("updater did not finish the terminal scenario within 20 seconds")
            ready, _, _ = select.select([child.stdout], [], [], 0.1)
            if ready:
                data = os.read(child.stdout.fileno(), 65536)
                if not data:
                    break
                transcript.extend(data)
                if len(transcript) > 262144:
                    raise RuntimeError("updater terminal output exceeded the test limit")
            prompts = transcript.count(b"[y/N]")
            if prompts > sent and sent < len(responses):
                response = responses[sent]
                data = b"\x04" if response is None else response.encode("utf-8")
                # Inputs are deliberately tiny, but retain write completeness.
                while data:
                    written = os.write(master, data)
                    data = data[written:]
                sent += 1
        returncode = child.wait(timeout=2)
        if sent != len(responses):
            raise RuntimeError("updater exited before all expected terminal prompts")
        return returncode
    except (OSError, RuntimeError, TimeoutError, subprocess.TimeoutExpired) as error:
        # All helper diagnostics are test data, never credentials or real input.
        driver_error = error
        transcript.extend(("\nTerminal test driver: " + str(error) + "\n").encode("utf-8"))
        return 125
    finally:
        if child.poll() is None:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except OSError as error:
                if error.errno != errno.ESRCH:
                    raise
            child.wait()
        child.stdout.close()
        os.close(master)
        Path(output_path).write_bytes(transcript)
        if driver_error:
            print(str(driver_error), file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
