#!/usr/bin/env python3
"""Exercise the packaged mpv JSON IPC command needed before ABS playback."""

from __future__ import annotations

import json
import socket
import struct
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path


def command(socket_path: Path, request_id: int, *args: object) -> object:
    payload = json.dumps({"command": list(args), "request_id": request_id}).encode() + b"\n"
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(3)
        client.connect(str(socket_path))
        client.sendall(payload)
        buffer = b""
        while True:
            chunk = client.recv(65536)
            if not chunk:
                raise RuntimeError("mpv closed its IPC socket")
            buffer += chunk
            while b"\n" in buffer:
                line, buffer = buffer.split(b"\n", 1)
                response = json.loads(line)
                if response.get("request_id") != request_id:
                    continue
                if response.get("error") != "success":
                    raise RuntimeError(f"mpv rejected {args[0]}: {response.get('error')}")
                return response.get("data")


def main() -> None:
    binary = Path(sys.argv[1])
    with tempfile.TemporaryDirectory(prefix="decky-abs-mpv-") as directory:
        socket_path = Path(directory) / "mpv.sock"
        audio_path = Path(directory) / "seek-test.wav"
        with wave.open(str(audio_path), "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(8000)
            audio.writeframes(struct.pack("<h", 0) * 40000)
        process = subprocess.Popen(
            [
                str(binary),
                "--no-config",
                "--no-video",
                "--idle=yes",
                "--pause=yes",
                "--terminal=no",
                "--ao=null",
                f"--input-ipc-server={socket_path}",
            ]
        )
        try:
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline and not socket_path.exists():
                if process.poll() is not None:
                    raise RuntimeError(f"mpv exited during smoke-test startup: {process.returncode}")
                time.sleep(0.05)
            if not socket_path.exists():
                raise RuntimeError("mpv did not create its IPC socket")

            command(
                socket_path,
                1,
                "set_property",
                "options/http-header-fields",
                ["Authorization: Bearer smoke-test-token"],
            )
            command(socket_path, 2, "loadfile", str(audio_path), "replace", -1, {"start": "2.0"})

            request_id = 3
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                try:
                    position = command(socket_path, request_id, "get_property", "time-pos")
                except RuntimeError:
                    position = None
                request_id += 1
                if position is not None and float(position) >= 1.9:
                    break
                time.sleep(0.05)
            else:
                raise RuntimeError(f"loaded smoke-test audio did not start at 2 seconds (position={position})")

            command(socket_path, request_id, "quit")
            process.wait(timeout=5)
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)

    print("mpv IPC authorization-header and start-position smoke test passed")


if __name__ == "__main__":
    main()
