import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "py_modules"))

from abs_player_core.api import ApiError, AudiobookshelfClient
from abs_player_core.models import chapter_at, item_summary, session_view
from abs_player_core.player import MpvPlayer


class FakeLogger:
    def info(self, *_args):
        pass


class CoreModelTests(unittest.TestCase):
    def test_normalizes_search_result(self):
        result = item_summary(
            {
                "libraryItem": {
                    "id": "book-1",
                    "libraryId": "library-1",
                    "media": {
                        "duration": 123,
                        "metadata": {"title": "A Book", "authorName": "An Author"},
                    },
                    "userMediaProgress": {"currentTime": 12, "progress": 0.1},
                }
            }
        )
        self.assertEqual(result["id"], "book-1")
        self.assertEqual(result["title"], "A Book")
        self.assertEqual(result["currentTime"], 12)

    def test_chapter_lookup_uses_latest_started_chapter(self):
        chapters = [
            {"title": "One", "start": 0},
            {"title": "Two", "start": 60},
            {"title": "Three", "start": 120},
        ]
        index, chapter = chapter_at(chapters, 90)
        self.assertEqual(index, 1)
        self.assertEqual(chapter["title"], "Two")

    def test_session_tracks_are_numeric(self):
        session = session_view(
            {
                "id": "session-1",
                "audioTracks": [
                    {"contentUrl": "/one", "startOffset": "0", "duration": "60"},
                    {"contentUrl": "/two", "startOffset": "60", "duration": "60"},
                ],
            }
        )
        self.assertEqual(session["tracks"][1]["startOffset"], 60.0)


class ApiTests(unittest.TestCase):
    def test_rejects_server_url_credentials(self):
        with self.assertRaises(ApiError):
            AudiobookshelfClient("https://user:password@example.test")

    def test_401_rotates_tokens_and_retries(self):
        calls = []

        def transport(method, url, headers, body, _context):
            calls.append((method, url, headers, body))
            if url.endswith("/api/libraries") and headers.get("Authorization") == "Bearer old-access":
                return 401, b'{"error":"expired"}', {}
            if url.endswith("/auth/refresh"):
                self.assertEqual(headers["x-refresh-token"], "old-refresh")
                payload = {"user": {"accessToken": "new-access", "refreshToken": "new-refresh"}}
                return 200, json.dumps(payload).encode(), {"Content-Type": "application/json"}
            if url.endswith("/api/libraries") and headers.get("Authorization") == "Bearer new-access":
                return 200, b'{"libraries":[{"id":"lib","mediaType":"book"}]}', {}
            return 500, b"unexpected", {}

        client = AudiobookshelfClient(
            "https://example.test",
            access_token="old-access",
            refresh_token="old-refresh",
            transport=transport,
        )
        self.assertEqual(client.libraries()[0]["id"], "lib")
        self.assertEqual(client.access_token, "new-access")
        self.assertEqual(client.refresh_token, "new-refresh")
        self.assertEqual(len(calls), 3)


class PlayerMappingTests(unittest.TestCase):
    def test_maps_book_position_to_track(self):
        with tempfile.TemporaryDirectory() as directory:
            player = MpvPlayer(directory, directory, FakeLogger())
            player._tracks = [
                {"startOffset": 0},
                {"startOffset": 60},
                {"startOffset": 120},
            ]
            self.assertEqual(player._track_index_at(119.5), 1)
            self.assertEqual(player._track_index_at(120), 2)


if __name__ == "__main__":
    unittest.main()
