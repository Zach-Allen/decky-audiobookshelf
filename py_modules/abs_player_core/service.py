"""Orchestrates API, background playback, and periodic progress sync."""

from __future__ import annotations

import asyncio
import base64
import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Callable

from .api import ApiError, AudiobookshelfClient
from .models import chapter_at
from .player import MpvPlayer, PlayerError


class AudiobookshelfService:
    SYNC_INTERVAL = 15.0

    def __init__(self, settings_dir: str, runtime_dir: str, plugin_dir: str, logger: Any):
        self.settings_dir = Path(settings_dir)
        self.settings_path = self.settings_dir / "settings.json"
        self.logger = logger
        self.player = MpvPlayer(runtime_dir, plugin_dir, logger)
        self.client: AudiobookshelfClient | None = None
        self.settings: dict[str, Any] = {}
        self.session: dict[str, Any] | None = None
        self.last_error = ""
        self._monitor_task: asyncio.Task[None] | None = None
        self._last_monitor = time.monotonic()
        self._last_sync = time.monotonic()
        self._time_listened = 0.0
        self._sync_lock = asyncio.Lock()

    async def start(self) -> None:
        self.settings_dir.mkdir(parents=True, exist_ok=True)
        self.settings = self._load_settings()
        self.settings.setdefault("deviceId", str(uuid.uuid4()))
        if self.settings.get("serverUrl") and self.settings.get("accessToken"):
            self._make_client()
            try:
                await self._call(self.client.authorize)
                self.last_error = ""
            except ApiError as error:
                self.last_error = f"Saved login needs attention: {error}"
        self._save_settings()
        self._monitor_task = asyncio.create_task(self._monitor(), name="abs-progress-monitor")

    def _load_settings(self) -> dict[str, Any]:
        try:
            return json.loads(self.settings_path.read_text())
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return {}

    def _save_settings(self) -> None:
        self.settings_dir.mkdir(parents=True, exist_ok=True)
        temp_path = self.settings_path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(self.settings, indent=2))
        os.chmod(temp_path, 0o600)
        temp_path.replace(self.settings_path)

    def _make_client(self) -> None:
        self.client = AudiobookshelfClient(
            self.settings.get("serverUrl", ""),
            self.settings.get("accessToken", ""),
            self.settings.get("refreshToken", ""),
            self.settings.get("verifyTls", True),
        )

    async def _call(self, function: Callable[..., Any], *args: Any) -> Any:
        result = await asyncio.to_thread(function, *args)
        if self.client:
            changed = (
                self.settings.get("accessToken") != self.client.access_token
                or self.settings.get("refreshToken") != self.client.refresh_token
            )
            if changed:
                self.settings["accessToken"] = self.client.access_token
                self.settings["refreshToken"] = self.client.refresh_token
                self._save_settings()
                if self.session:
                    await asyncio.to_thread(
                        self.player.update_access_token,
                        self.client.access_token,
                    )
        return result

    def _require_client(self) -> AudiobookshelfClient:
        if not self.client or not self.client.access_token:
            raise ApiError("Configure and sign in to an Audiobookshelf server first", 401)
        return self.client

    async def configure(self, server_url: str, username: str, password: str, verify_tls: bool = True):
        client = AudiobookshelfClient(server_url, verify_tls=verify_tls)
        response = await asyncio.to_thread(client.login, username.strip(), password)
        self.client = client
        self.settings.update(
            {
                "serverUrl": client.server_url,
                "username": username.strip(),
                "accessToken": client.access_token,
                "refreshToken": client.refresh_token,
                "verifyTls": verify_tls,
            }
        )
        self._save_settings()
        self.last_error = ""
        libraries = await self.get_libraries()
        return {
            "success": True,
            "username": (response.get("user") or {}).get("username", username),
            "libraries": libraries,
        }

    async def logout(self):
        await self.stop()
        if self.client:
            try:
                await self._call(self.client.logout)
            except ApiError as error:
                self.logger.warning(f"Server logout failed: {error}")
        for key in ("accessToken", "refreshToken"):
            self.settings.pop(key, None)
        self._save_settings()
        self.client = None
        return {"success": True}

    async def get_libraries(self):
        client = self._require_client()
        libraries = await self._call(client.libraries)
        self.last_error = ""
        return [
            {"id": item.get("id"), "name": item.get("name", "Library"), "mediaType": item.get("mediaType")}
            for item in libraries
        ]

    async def get_continue_listening(self, library_id: str):
        result = await self._call(self._require_client().continue_listening, library_id)
        self.last_error = ""
        return result

    async def browse_library(self, library_id: str, page: int = 0, limit: int = 24):
        result = await self._call(
            self._require_client().browse,
            library_id,
            max(0, page),
            max(1, min(limit, 50)),
        )
        self.last_error = ""
        return result

    async def search(self, library_id: str, query: str):
        if not query.strip():
            return []
        result = await self._call(self._require_client().search, library_id, query.strip())
        self.last_error = ""
        return result

    async def get_book(self, item_id: str):
        return await self._call(self._require_client().item, item_id)

    async def get_cover(self, item_id: str):
        body, content_type = await self._call(self._require_client().cover_bytes, item_id)
        return f"data:{content_type};base64,{base64.b64encode(body).decode()}"

    async def play_item(self, item_id: str):
        await self.stop()
        client = self._require_client()
        session: dict[str, Any] | None = None
        self.last_error = ""
        try:
            session = await self._call(client.start_playback, item_id, self.settings["deviceId"])
            status = await self._call(
                self.player.play_session,
                session,
                client.server_url,
                client.access_token,
            )
        except Exception as error:
            if session and session.get("id"):
                try:
                    await self._call(
                        client.close_session,
                        session["id"],
                        session.get("startTime", 0),
                        session.get("duration", 0),
                        0,
                    )
                except ApiError:
                    pass
            # A failed open can leave mpv holding a dead HLS URL or stale IPC
            # state. Tear it down completely so the very next Play starts clean.
            try:
                await self._call(self.player.shutdown)
            except Exception:
                self.logger.exception("Could not reset the audio player after a failed start")
            self.session = None
            self._time_listened = 0
            self.last_error = f"Could not start playback: {error}"
            self.logger.exception(self.last_error)
            raise RuntimeError(self.last_error) from error
        self.session = session
        self._time_listened = 0
        self._last_sync = time.monotonic()
        self.last_error = ""
        return self._with_session(status)

    def _with_session(self, status: dict[str, Any]) -> dict[str, Any]:
        if not self.session:
            return {**status, "session": None, "chapter": None, "chapterIndex": -1}
        chapter_index, chapter = chapter_at(
            self.session.get("chapters") or [],
            float(status.get("position") or 0),
        )
        return {
            **status,
            "session": {
                "id": self.session.get("id"),
                "libraryItemId": self.session.get("libraryItemId"),
                "title": self.session.get("title"),
                "author": self.session.get("author"),
            },
            "chapter": chapter,
            "chapterIndex": chapter_index,
        }

    async def get_state(self):
        try:
            playback = await self._call(self.player.status)
        except PlayerError as error:
            playback = {"available": False, "isPlaying": False, "isPaused": False, "position": 0, "duration": 0, "speed": 1}
            self.last_error = str(error)
        return {
            "configured": bool(self.client and self.client.access_token),
            "serverUrl": self.settings.get("serverUrl", ""),
            "username": self.settings.get("username", ""),
            "verifyTls": self.settings.get("verifyTls", True),
            "error": self.last_error,
            "playback": self._with_session(playback),
        }

    async def toggle_play_pause(self):
        before = await self._call(self.player.status)
        status = await self._call(self.player.toggle_pause)
        if before.get("isPlaying"):
            await self._sync_progress()
        return self._with_session(status)

    async def seek_relative(self, seconds: float):
        await self._sync_progress()
        status = await self._call(self.player.seek_relative, float(seconds))
        await self._sync_progress()
        return self._with_session(status)

    async def _seek_chapter(self, direction: int):
        if not self.session:
            raise PlayerError("Nothing is loaded")
        status = await self._call(self.player.status)
        chapters = self.session.get("chapters") or []
        index, chapter = chapter_at(chapters, status.get("position", 0))
        if not chapter:
            raise PlayerError("This audiobook has no chapter metadata")
        if direction < 0 and status.get("position", 0) <= float(chapter.get("start") or 0) + 3:
            index = max(0, index - 1)
        elif direction > 0:
            index = min(len(chapters) - 1, index + 1)
        await self._sync_progress()
        result = await self._call(self.player.seek, float(chapters[index].get("start") or 0))
        return self._with_session(result)

    async def previous_chapter(self):
        return await self._seek_chapter(-1)

    async def next_chapter(self):
        return await self._seek_chapter(1)

    async def set_speed(self, speed: float):
        return self._with_session(await self._call(self.player.set_speed, speed))

    async def _sync_progress(self, close: bool = False):
        if not self.session or not self.client:
            return
        async with self._sync_lock:
            status = await self._call(self.player.status)
            listened = self._time_listened
            try:
                sync = self.client.close_session if close else self.client.sync_session
                await self._call(
                    sync,
                    self.session["id"],
                    float(status.get("position") or 0),
                    float(self.session.get("duration") or 0),
                    listened,
                )
                self._time_listened = 0
                self._last_sync = time.monotonic()
            except ApiError as error:
                self.last_error = f"Progress sync failed: {error}"
                self.logger.error(self.last_error)
                if close:
                    self.session = None
                return
            if close:
                self.session = None

    async def stop(self):
        if self.session:
            await self._sync_progress(close=True)
        await self._call(self.player.stop)
        return {"success": True}

    async def _monitor(self) -> None:
        while True:
            try:
                await asyncio.sleep(1)
                now = time.monotonic()
                elapsed = min(now - self._last_monitor, 2.0)
                self._last_monitor = now
                if not self.session:
                    continue
                status = await self._call(self.player.status)
                if status.get("isPlaying"):
                    self._time_listened += elapsed
                if now - self._last_sync >= self.SYNC_INTERVAL:
                    await self._sync_progress()
            except asyncio.CancelledError:
                return
            except Exception as error:  # keep background synchronization alive
                self.last_error = f"Playback monitor error: {error}"
                self.logger.exception(self.last_error)

    async def get_diagnostics(self):
        return {
            **self.player.diagnostics(),
            "playerLog": str(self.player.log_path),
            "serverConfigured": bool(self.settings.get("serverUrl")),
            "hasAccessToken": bool(self.settings.get("accessToken")),
            "hasRefreshToken": bool(self.settings.get("refreshToken")),
            "sessionOpen": bool(self.session),
            "lastError": self.last_error,
        }

    async def shutdown(self) -> None:
        if self._monitor_task:
            self._monitor_task.cancel()
            await asyncio.gather(self._monitor_task, return_exceptions=True)
            self._monitor_task = None
        if self.session:
            await self._sync_progress(close=True)
        await self._call(self.player.shutdown)
