# Decky Audiobookshelf

A controller-native Audiobookshelf client for the Steam Deck Quick Access Menu.

This repository is an early v0.1 proof of concept. It can authenticate with current Audiobookshelf JWT/refresh-token APIs, load book libraries and Continue Listening, browse/search, start an Audiobookshelf playback session, control a background `mpv` process, show chapter metadata, change speed, and periodically synchronize progress.

## Current vertical slice

- Sign in with server URL, username, and password.
- Store the short-lived access token and rotating refresh token in Decky's per-plugin settings directory with mode `0600`.
- Refresh an expired access token and persist the rotated pair.
- Browse book libraries, Continue Listening, and search results.
- Start/resume the server's official playback session.
- Play direct or transcoded session tracks in an out-of-CEF `mpv` process.
- Play/pause, ±30 seconds, previous/next chapter, and 0.5–3× speed.
- Sync current time and listened time every 15 seconds and close the session on stop/unload.
- Render all actions with Decky/Steam focusable controls.

The proof of concept has not yet been exercised on physical Steam Deck hardware. In particular, simultaneous game + audiobook mixing and suspend/resume recovery are acceptance tests, not completed claims. See [the POC checklist](docs/POC_CHECKLIST.md).

## Architecture

```text
Decky React panel (presentation and controller focus only)
        │ @decky/api typed RPC
        ▼
main.py (thin Decky adapter)
        │
        ▼
py_modules/abs_player_core
  ├── Audiobookshelf HTTP/JWT client
  ├── session + progress coordinator
  └── mpv JSON-IPC controller
        │
        ▼
mpv → PipeWire default sink
```

The panel can disappear without stopping playback because the player is a separate native process owned by the plugin backend. The plugin deliberately does **not** request Decky's root flag, so its process runs as the Deck user and can connect to the user's PipeWire session.

For v0.1, Python is orchestration rather than the audio engine; decoding, buffering, seeking, time-stretching, and PipeWire output all live in native `mpv`. A Rust sidecar remains a sensible packaging target once the hardware POC is proven, especially for first-class MPRIS and tighter lifecycle management. The reasoning and alternatives are in [research notes](docs/RESEARCH.md).

## Requirements

- Decky Loader using plugin API v1.
- An Audiobookshelf server with a book library.
- `mpv` available at `/usr/bin/mpv`, on `PATH`, or bundled as `bin/mpv`.
- Node.js 16.14+ and pnpm 9 for development, matching the official Decky template guidance.

`mpv` must include a PipeWire or PulseAudio output. The player requests `pipewire,pulse,alsa` in that order.

## Build and test

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm test
pnpm run typecheck
```

The build script drives the official Decky Rollup configuration through its API and writes `dist/index.js`. The small wrapper exits explicitly to avoid a Node 24/macOS dependency handle that otherwise remains open after Rollup finishes. Python has no third-party runtime dependencies.

## Install on a development Steam Deck

1. Build the frontend.
2. Copy the repository contents (excluding `.git`, `node_modules`, and tests) to:

   ```text
   /home/deck/homebrew/plugins/decky-audiobookshelf/
   ```

3. If SteamOS does not provide `mpv`, place a compatible executable at `bin/mpv` and make it executable.
4. Restart the Decky plugin loader:

   ```bash
   sudo systemctl restart plugin_loader
   ```

5. Open **… → Decky → Audiobookshelf**, enter the server URL and credentials, and run the POC checklist.

For repeatable releases, the next packaging checkpoint is a Decky-compatible zip with an x86_64 Linux `mpv` artifact and its license notices. Do not redistribute an arbitrary static build without auditing its codec and GPL/LGPL obligations.

## Security notes

- Passwords are used only for `/login` and are not persisted.
- Tokens remain in Decky's private plugin settings directory and never enter the React UI.
- TLS verification is on by default. The toggle for self-signed certificates is explicit.
- The bearer token is sent to `mpv` over a local Unix socket, not exposed in its process arguments.
- The plugin runs without root privileges.

## Repository layout

```text
main.py                         Decky RPC adapter
src/index.tsx                   controller-native Quick Access UI
py_modules/abs_player_core/     reusable API/player/session core
tests/                          dependency-free unit tests
docs/RESEARCH.md                source-backed technical decisions
docs/POC_CHECKLIST.md           physical Deck acceptance checklist
```

## Known gaps

- No bundled `mpv` binary yet.
- MPRIS is designed but not implemented.
- OIDC login, offline downloads, sleep timer, bookmarks, podcasts, queues, and multiple servers are out of v0.1 scope.
- No reconnect after suspend or mpv crash yet.
- The first panel keeps browsing deliberately simple; full-page library/detail routes come after the audio POC.
