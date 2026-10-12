"""mpv subprocess controlled through its documented JSON IPC interface."""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import threading
import time
from pathlib import Path
from typing import Any


class PlayerError(RuntimeError):
    pass


class MpvPlayer:
    def __init__(self, runtime_dir: str, plugin_dir: str, logger: Any):
        self.runtime_dir = Path(runtime_dir)
        self.plugin_dir = Path(plugin_dir)
        self.logger = logger
        self.socket_path = self.runtime_dir / "mpv.sock"
        self.log_path = self.runtime_dir / "mpv.log"
        self.process: subprocess.Popen[bytes] | None = None
        self._lock = threading.RLock()
        self._request_id = 0
        self._tracks: list[dict[str, Any]] = []
        self._loaded_tracks: list[dict[str, Any]] = []
        self._server_url = ""
        self._access_token = ""
        self._duration = 0.0

    def _find_binary(self) -> str:
        bundled = self.plugin_dir / "bin" / "mpv"
        if bundled.is_file() and not os.access(bundled, os.X_OK):
            # Some manual ZIP extractors discard Unix executable bits. Decky's
            # plugin directory is read-only at runtime, so stage a private copy
            # in the writable runtime directory and repair its mode there.
            self.runtime_dir.mkdir(parents=True, exist_ok=True)
            staged = self.runtime_dir / "mpv"
            shutil.copyfile(bundled, staged)
            os.chmod(staged, 0o755)
            if os.access(staged, os.X_OK):
                return str(staged)

        candidates = [str(bundled), "/usr/bin/mpv", "/bin/mpv"]
        path_mpv = shutil.which("mpv")
        if path_mpv:
            candidates.append(path_mpv)
        for candidate in candidates:
            if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                return candidate
        raise PlayerError(
            "mpv was not found. Install mpv on the Deck or place a compatible executable at bin/mpv."
        )

    def _log_tail(self, limit: int = 1200) -> str:
        try:
            text = self.log_path.read_bytes()[-8192:].decode("utf-8", "replace")
        except OSError:
            return ""
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return " | ".join(lines[-8:])[-limit:]

    def _failure(self, message: str) -> PlayerError:
        detail = self._log_tail()
        return PlayerError(f"{message}: {detail}" if detail else message)

    def ensure_started(self) -> None:
        with self._lock:
            if self.process and self.process.poll() is None and self.socket_path.exists():
                return
            self.runtime_dir.mkdir(parents=True, exist_ok=True)
            self.socket_path.unlink(missing_ok=True)
            binary = self._find_binary()
            args = [
                binary,
                "--no-config",
                "--no-video",
                "--audio-display=no",
                "--idle=yes",
                "--pause=yes",
                "--terminal=no",
                "--input-default-bindings=no",
                f"--input-ipc-server={self.socket_path}",
                "--audio-client-name=Decky Audiobookshelf",
                "--ao=pulse,alsa",
                "--volume=100",
            ]
            try:
                with self.log_path.open("ab", buffering=0) as log_file:
                    self.process = subprocess.Popen(args, stdout=log_file, stderr=log_file, close_fds=True)
            except OSError as error:
                raise self._failure(f"Could not launch the bundled audio player ({error})") from error
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                if self.process.poll() is not None:
                    raise self._failure(f"Audio player exited during startup (code {self.process.returncode})")
                if self.socket_path.exists():
                    self.logger.info("mpv background player started")
                    return
                time.sleep(0.05)
            self.process.terminate()
            raise self._failure("Timed out waiting for the audio player")

    def _command(self, *command: Any) -> Any:
        with self._lock:
            self.ensure_started()
            self._request_id += 1
            request_id = self._request_id
            payload = json.dumps({"command": list(command), "request_id": request_id}).encode() + b"\n"
            try:
                with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
                    client.settimeout(3)
                    client.connect(str(self.socket_path))
                    client.sendall(payload)
                    buffer = b""
                    while True:
                        chunk = client.recv(65536)
                        if not chunk:
                            raise PlayerError("mpv closed its control socket")
                        buffer += chunk
                        while b"\n" in buffer:
                            line, buffer = buffer.split(b"\n", 1)
                            response = json.loads(line)
                            if response.get("request_id") != request_id:
                                continue
                            if response.get("error") != "success":
                                command_name = str(command[0]) if command else "unknown"
                                raise PlayerError(
                                    f"mpv command {command_name!r} failed: {response.get('error')}"
                                )
                            return response.get("data")
            except (OSError, json.JSONDecodeError) as error:
                raise PlayerError(f"Could not communicate with mpv: {error}") from error

    def _get(self, name: str, default: Any = None) -> Any:
        try:
            result = self._command("get_property", name)
            return default if result is None else result
        except PlayerError:
            return default

    def _absolute_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self._server_url.rstrip('/')}/{path.lstrip('/')}"

    def _track_index_at(self, position: float) -> int:
        if not self._tracks:
            raise PlayerError("Playback session did not include audio tracks")
        selected = 0
        for index, track in enumerate(self._tracks):
            start = float(track.get("startOffset") or 0)
            if start <= position:
                selected = index
            else:
                break
        return selected

    def play_session(self, session: dict[str, Any], server_url: str, access_token: str) -> dict[str, Any]:
        self._tracks = list(session.get("tracks") or [])
        self._server_url = server_url
        self._access_token = access_token
        self._duration = float(session.get("duration") or 0)
        self.ensure_started()
        self._set_http_headers(access_token)
        self._load_at(float(session.get("startTime") or 0), paused=False)
        return self.status()

    def _set_http_headers(self, access_token: str) -> None:
        # http-header-fields is an mpv option rather than a top-level property.
        # The options/ namespace is writable while the player is idle and also
        # updates the header used when subsequent playlist tracks are opened.
        self._command(
            "set_property",
            "options/http-header-fields",
            [f"Authorization: Bearer {access_token}"],
        )

    def update_access_token(self, access_token: str) -> None:
        """Update headers used for tracks mpv has not opened yet."""
        self._access_token = access_token
        if self.process and self.process.poll() is None and self.socket_path.exists():
            self._set_http_headers(access_token)

    def _load_at(self, position: float, paused: bool) -> None:
        position = max(0.0, min(position, self._duration or position))
        index = self._track_index_at(position)
        self._loaded_tracks = self._tracks[index:]
        first = self._loaded_tracks[0]
        first_url = first.get("contentUrl")
        if not first_url:
            raise PlayerError("Playback session returned a track without a content URL")
        local_position = max(0.0, position - float(first.get("startOffset") or 0))
        # Supplying start as a per-file option makes mpv seek while opening the
        # demuxer. This avoids the race where a separate seek command arrives
        # before a remote file has finished becoming seekable.
        load_options = {"start": str(local_position)} if local_position else {}
        self._command(
            "loadfile",
            self._absolute_url(first_url),
            "replace",
            -1,
            load_options,
        )
        for track in self._loaded_tracks[1:]:
            url = track.get("contentUrl")
            if url:
                self._command("loadfile", self._absolute_url(url), "append")
        deadline = time.monotonic() + 10
        loaded = False
        while time.monotonic() < deadline:
            if self.process and self.process.poll() is not None:
                raise self._failure(f"Audio player exited while opening the stream (code {self.process.returncode})")
            if not self._get("idle-active", True):
                loaded = True
                break
            time.sleep(0.05)
        if not loaded:
            raise self._failure("The audio player could not open the Audiobookshelf stream")
        self._command("set_property", "pause", paused)

    def status(self) -> dict[str, Any]:
        alive = bool(self.process and self.process.poll() is None and self.socket_path.exists())
        if not alive or not self._loaded_tracks:
            return {
                "available": self.binary_available(),
                "isPlaying": False,
                "isPaused": False,
                "position": 0,
                "duration": self._duration,
                "speed": 1.0,
            }
        idle = bool(self._get("idle-active", True))
        paused = bool(self._get("pause", False))
        playlist_pos = int(self._get("playlist-pos", 0) or 0)
        playlist_pos = max(0, min(playlist_pos, len(self._loaded_tracks) - 1))
        local_position = float(self._get("time-pos", 0) or 0)
        offset = float(self._loaded_tracks[playlist_pos].get("startOffset") or 0)
        return {
            "available": True,
            "isPlaying": not idle and not paused,
            "isPaused": not idle and paused,
            "position": min(offset + local_position, self._duration or offset + local_position),
            "duration": self._duration,
            "speed": float(self._get("speed", 1.0) or 1.0),
        }

    def binary_available(self) -> bool:
        try:
            self._find_binary()
            return True
        except PlayerError:
            return False

    def diagnostics(self) -> dict[str, Any]:
        try:
            binary = self._find_binary()
            available = True
        except PlayerError as error:
            binary = ""
            available = False
            find_error = str(error)
        return {
            "playerFound": available,
            "playerPath": binary,
            "playerRunning": bool(self.process and self.process.poll() is None),
            "playerExitCode": self.process.poll() if self.process else None,
            "playerLogTail": self._log_tail(),
            "playerError": "" if available else find_error,
        }

    def toggle_pause(self) -> dict[str, Any]:
        current = self.status()
        if not self._loaded_tracks:
            raise PlayerError("Nothing is loaded")
        self._command("set_property", "pause", not current["isPaused"])
        return self.status()

    def seek(self, position: float) -> dict[str, Any]:
        paused = self.status().get("isPaused", False)
        self._load_at(position, paused=paused)
        return self.status()

    def seek_relative(self, seconds: float) -> dict[str, Any]:
        return self.seek(float(self.status().get("position") or 0) + seconds)

    def set_speed(self, speed: float) -> dict[str, Any]:
        speed = max(0.5, min(float(speed), 3.0))
        self._command("set_property", "speed", speed)
        return self.status()

    def stop(self) -> None:
        if self.process and self.process.poll() is None:
            try:
                self._command("stop")
            except PlayerError:
                pass
        self._tracks = []
        self._loaded_tracks = []
        self._duration = 0.0

    def shutdown(self) -> None:
        process = self.process
        if process and process.poll() is None:
            try:
                self._command("quit")
                process.wait(timeout=2)
            except (PlayerError, subprocess.TimeoutExpired):
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=2)
        self.process = None
        self._tracks = []
        self._loaded_tracks = []
        self._duration = 0.0
        self.socket_path.unlink(missing_ok=True)
