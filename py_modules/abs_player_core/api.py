"""Dependency-free Audiobookshelf HTTP client with rotating JWT support."""

from __future__ import annotations

import json
import ssl
import threading
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Optional

from .models import item_summary, session_view


class ApiError(RuntimeError):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


Transport = Callable[
    [str, str, dict[str, str], Optional[bytes], ssl.SSLContext],
    tuple[int, bytes, dict[str, str]],
]


def _default_transport(method: str, url: str, headers: dict[str, str], body: bytes | None, context: ssl.SSLContext):
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20, context=context) as response:
            return response.status, response.read(), dict(response.headers)
    except urllib.error.HTTPError as error:
        return error.code, error.read(), dict(error.headers)
    except urllib.error.URLError as error:
        raise ApiError(f"Cannot reach Audiobookshelf: {error.reason}") from error


class AudiobookshelfClient:
    def __init__(
        self,
        server_url: str,
        access_token: str = "",
        refresh_token: str = "",
        verify_tls: bool = True,
        transport: Transport | None = None,
    ):
        self.server_url = self.normalize_server_url(server_url)
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.verify_tls = verify_tls
        self.transport = transport or _default_transport
        self._refresh_lock = threading.Lock()

    @staticmethod
    def normalize_server_url(value: str) -> str:
        value = value.strip().rstrip("/")
        parsed = urllib.parse.urlparse(value)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ApiError("Server address must start with http:// or https://")
        if parsed.username or parsed.password:
            raise ApiError("Put credentials in the username and password fields, not the URL")
        return value

    def absolute_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self.server_url}/{path.lstrip('/')}"

    def _context(self) -> ssl.SSLContext:
        if self.verify_tls:
            return ssl.create_default_context()
        return ssl._create_unverified_context()  # noqa: SLF001 - explicit user setting

    def _request(
        self,
        method: str,
        path: str,
        payload: Any = None,
        auth: bool = True,
        retry: bool = True,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        headers = {"Accept": "application/json", "User-Agent": "Decky Audiobookshelf/0.1"}
        if payload is not None:
            headers["Content-Type"] = "application/json"
        if auth and self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        headers.update(extra_headers or {})
        body = json.dumps(payload).encode() if payload is not None else None
        status, response_body, _ = self.transport(
            method,
            self.absolute_url(path),
            headers,
            body,
            self._context(),
        )
        if status == 401 and auth and retry and self.refresh_token:
            self.refresh()
            return self._request(method, path, payload, auth, False, extra_headers)
        if status < 200 or status >= 300:
            message = response_body.decode("utf-8", "replace")[:500] or f"HTTP {status}"
            try:
                decoded = json.loads(message)
                message = decoded.get("error") or decoded.get("message") or message
            except json.JSONDecodeError:
                pass
            raise ApiError(message, status)
        if not response_body:
            return None
        content = response_body.decode("utf-8")
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return content

    def login(self, username: str, password: str) -> dict[str, Any]:
        response = self._request(
            "POST",
            "/login",
            {"username": username, "password": password},
            auth=False,
            extra_headers={"x-return-tokens": "true"},
        )
        user = response.get("user") or {}
        self.access_token = user.get("accessToken") or user.get("token") or ""
        self.refresh_token = user.get("refreshToken") or ""
        if not self.access_token:
            raise ApiError("Server login succeeded but returned no access token")
        return response

    def refresh(self) -> None:
        with self._refresh_lock:
            response = self._request(
                "POST",
                "/auth/refresh",
                auth=False,
                retry=False,
                extra_headers={"x-refresh-token": self.refresh_token},
            )
            user = response.get("user") or {}
            self.access_token = user.get("accessToken") or ""
            self.refresh_token = user.get("refreshToken") or self.refresh_token
            if not self.access_token:
                raise ApiError("Token refresh returned no access token", 401)

    def authorize(self) -> dict[str, Any]:
        return self._request("POST", "/api/authorize")

    def logout(self) -> None:
        try:
            self._request("POST", "/logout", extra_headers={"x-refresh-token": self.refresh_token})
        finally:
            self.access_token = ""
            self.refresh_token = ""

    def libraries(self) -> list[dict[str, Any]]:
        response = self._request("GET", "/api/libraries")
        return [lib for lib in response.get("libraries", []) if lib.get("mediaType") == "book"]

    def continue_listening(self, library_id: str) -> list[dict[str, Any]]:
        library_id = urllib.parse.quote(library_id)
        shelves = self._request("GET", f"/api/libraries/{library_id}/personalized?limit=20&include=progress")
        shelf = next((entry for entry in shelves if entry.get("id") == "continue-listening"), None)
        return [item_summary(item) for item in (shelf or {}).get("entities", [])]

    def browse(self, library_id: str, page: int, limit: int) -> dict[str, Any]:
        query = urllib.parse.urlencode(
            {"page": page, "limit": limit, "sort": "media.metadata.title", "desc": 0, "include": "progress"}
        )
        path = f"/api/libraries/{urllib.parse.quote(library_id)}/items?{query}"
        response = self._request("GET", path)
        return {
            "items": [item_summary(item) for item in response.get("results", [])],
            "total": response.get("total", 0),
            "page": page,
        }

    def search(self, library_id: str, query: str) -> list[dict[str, Any]]:
        params = urllib.parse.urlencode({"q": query, "limit": 30})
        response = self._request("GET", f"/api/libraries/{urllib.parse.quote(library_id)}/search?{params}")
        candidates = response.get("book") or response.get("items") or response.get("results") or []
        return [item_summary(item) for item in candidates]

    def item(self, item_id: str) -> dict[str, Any]:
        response = self._request(
            "GET",
            f"/api/items/{urllib.parse.quote(item_id)}?expanded=1&include=progress",
        )
        result = item_summary(response)
        result["chapters"] = (response.get("media") or {}).get("chapters") or []
        return result

    def cover_bytes(self, item_id: str, retry: bool = True) -> tuple[bytes, str]:
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "User-Agent": "Decky Audiobookshelf/0.1",
        }
        status, body, response_headers = self.transport(
            "GET",
            self.absolute_url(f"/api/items/{urllib.parse.quote(item_id)}/cover?width=300"),
            headers,
            None,
            self._context(),
        )
        if status == 401 and retry and self.refresh_token:
            self.refresh()
            return self.cover_bytes(item_id, retry=False)
        if status < 200 or status >= 300:
            raise ApiError(f"Cover request failed with HTTP {status}", status)
        content_type = response_headers.get("Content-Type") or response_headers.get("content-type") or "image/jpeg"
        return body, content_type

    def start_playback(self, item_id: str, device_id: str) -> dict[str, Any]:
        response = self._request(
            "POST",
            f"/api/items/{urllib.parse.quote(item_id)}/play",
            {
                "deviceInfo": {
                    "deviceId": device_id,
                    "clientName": "Decky Audiobookshelf",
                    "clientVersion": "0.1.0",
                    "manufacturer": "Valve",
                    "model": "Steam Deck",
                },
                # mpv supports the source formats Audiobookshelf serves. Asking
                # the server to transcode creates a live HLS playlist which mpv
                # can report as non-seekable and is unnecessary on the Deck.
                "forceDirectPlay": True,
                "forceTranscode": False,
                "supportedMimeTypes": [
                    "audio/mpeg",
                    "audio/mp4",
                    "audio/aac",
                    "audio/flac",
                    "audio/ogg",
                    "audio/opus",
                    "audio/x-m4a",
                    "audio/x-m4b",
                ],
                "mediaPlayer": "mpv",
            },
        )
        return session_view(response)

    def sync_session(self, session_id: str, current_time: float, duration: float, time_listened: float) -> None:
        self._request(
            "POST",
            f"/api/session/{session_id}/sync",
            {"currentTime": current_time, "duration": duration, "timeListened": time_listened},
        )

    def close_session(self, session_id: str, current_time: float, duration: float, time_listened: float) -> None:
        self._request(
            "POST",
            f"/api/session/{session_id}/close",
            {"currentTime": current_time, "duration": duration, "timeListened": time_listened},
        )
