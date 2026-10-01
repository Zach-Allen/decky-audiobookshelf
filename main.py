"""Decky RPC adapter for the reusable Audiobookshelf playback core."""

import os
import sys

import decky

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "py_modules"))

from abs_player_core.service import AudiobookshelfService  # noqa: E402


class Plugin:
    service: AudiobookshelfService

    async def _main(self):
        self.service = AudiobookshelfService(
            settings_dir=decky.DECKY_PLUGIN_SETTINGS_DIR,
            runtime_dir=decky.DECKY_PLUGIN_RUNTIME_DIR,
            plugin_dir=decky.DECKY_PLUGIN_DIR,
            logger=decky.logger,
        )
        await self.service.start()
        decky.logger.info("Audiobookshelf plugin ready")

    async def _unload(self):
        # Playback survives panel unmounts. Decky calls this only when the
        # plugin itself unloads, at which point the server session is closed.
        await self.service.shutdown()

    async def _uninstall(self):
        await self.service.shutdown()

    async def get_state(self):
        return await self.service.get_state()

    async def configure(self, server_url: str, username: str, password: str, verify_tls: bool = True):
        return await self.service.configure(server_url, username, password, verify_tls)

    async def logout(self):
        return await self.service.logout()

    async def get_libraries(self):
        return await self.service.get_libraries()

    async def get_continue_listening(self, library_id: str):
        return await self.service.get_continue_listening(library_id)

    async def browse_library(self, library_id: str, page: int = 0, limit: int = 24):
        return await self.service.browse_library(library_id, page, limit)

    async def search(self, library_id: str, query: str):
        return await self.service.search(library_id, query)

    async def get_book(self, item_id: str):
        return await self.service.get_book(item_id)

    async def get_cover(self, item_id: str):
        return await self.service.get_cover(item_id)

    async def play_item(self, item_id: str):
        return await self.service.play_item(item_id)

    async def toggle_play_pause(self):
        return await self.service.toggle_play_pause()

    async def seek_relative(self, seconds: float):
        return await self.service.seek_relative(seconds)

    async def previous_chapter(self):
        return await self.service.previous_chapter()

    async def next_chapter(self):
        return await self.service.next_chapter()

    async def set_speed(self, speed: float):
        return await self.service.set_speed(speed)

    async def stop(self):
        return await self.service.stop()

    async def get_diagnostics(self):
        return await self.service.get_diagnostics()
