# Technical research and v0.1 decisions

Research was refreshed on 2026-10-01 before implementation.

## Decky architecture

The project was scaffolded directly from the [official Decky plugin template](https://github.com/SteamDeckHomebrew/decky-plugin-template), inspected at commit `90d0780e882a17f5714fc6de044c645f22608290` (2026-04-10).

Current template facts that affect this plugin:

- Frontend code is React/TypeScript and uses [`@decky/ui`](https://github.com/SteamDeckHomebrew/decky-frontend-lib) plus [`@decky/api`](https://github.com/SteamDeckHomebrew/loader-api).
- Python methods on the `Plugin` class remain callable over Decky's RPC bridge.
- A plugin can instead ship compiled backends from `backend/src`; store CI expects output in `backend/out`, which is packaged as `bin/`.
- `DECKY_PLUGIN_SETTINGS_DIR`, `DECKY_PLUGIN_RUNTIME_DIR`, and `DECKY_PLUGIN_LOG_DIR` are the supported storage locations.
- The `_root` flag changes the backend user to root. This plugin omits it so a spawned player naturally reaches the Deck user's PipeWire socket.
- The current template pins plugin API version 1, `@decky/api` 1.1.3, and `@decky/ui` 4.11.0.

The UI uses `ButtonItem`, `DialogButton`, `TextField`, `SliderField`, `ToggleField`, and `Focusable`. These are Steam UI components participating in gamepad focus flow; no essential action is a raw browser button.

## Existing Decky audio/service patterns

- [Museck](https://github.com/Nezreka/Museck), inspected at `522687d0f8ca4cb6359547a6e814a99ddfe8576c`, is the closest precedent: a Decky Python backend owns an external `ffplay` process so streaming continues outside the visible panel. It also reports progress back to multiple media servers. Its control mechanism is process signals and wall-clock estimates, which makes accurate seek/speed/chapter behavior difficult.
- [Audio Loader](https://github.com/DeckThemes/SDH-AudioLoader) is useful precedent for audio-related Decky packaging, but its purpose is Steam UI sound replacement rather than durable media sessions.
- [DeckTunes](https://github.com/Sablinova/DeckTunes) is further evidence that independent playback can coexist with Gaming Mode, but it is theme-music oriented rather than an audiobook session client.
- [Steamcord](https://github.com/Necrosiak/Steamcord) keeps a native application alive behind a Quick Access control surface. It supports the same high-level decision here: do not make CEF visibility the owner of audio lifetime.

No inspected plugin provided a reusable MPRIS implementation.

## Audiobookshelf API, current source

The server source was inspected at `db433ce076ffba1869c434e0392ad8031eb9e2bb` (2026-10-01). The older [API reference](https://api.audiobookshelf.org/) explicitly says it is no longer maintained, so source is authoritative. Audiobookshelf also documents the JWT rollout in [discussion #4460](https://github.com/advplyr/audiobookshelf/discussions/4460).

### Authentication

- `POST /login` with username/password.
- Send `x-return-tokens: true` for a non-browser/mobile-style client.
- Read `user.accessToken` and `user.refreshToken`.
- Send `Authorization: Bearer <accessToken>` on API requests.
- On 401, call `POST /auth/refresh` with `x-refresh-token: <refreshToken>`.
- Persist **both** returned tokens because refresh tokens rotate.
- `POST /api/authorize` validates a saved access token.
- `POST /logout` accepts the same refresh-token header.

Legacy `user.token` remains a compatibility fallback during login, but it is not the primary v0.1 auth design.

### Discovery and metadata

- `GET /api/libraries` returns accessible libraries; v0.1 filters to `mediaType=book`.
- `GET /api/libraries/:id/personalized?include=progress` returns shelves. The `continue-listening` shelf contains resumable entities.
- `GET /api/libraries/:id/items` provides paginated browsing.
- `GET /api/libraries/:id/search?q=...` returns book/author/series match groups; v0.1 renders the direct book matches.
- `GET /api/items/:id?expanded=1&include=progress` returns expanded metadata, chapters, and user progress.
- `GET /api/items/:id/cover?width=300` returns artwork.

### Playback and progress

- `POST /api/items/:id/play` creates the official playback session.
- The request declares device identity, player name, supported MIME types, and direct/transcode preferences.
- The response contains `startTime`, global `duration`, `chapters`, and `audioTracks`.
- Direct tracks have authenticated `/api/items/:id/file/:fileId` content URLs, durations, and global `startOffset` values.
- Transcoded sessions expose a generated stream content URL in the returned audio track.
- `POST /api/session/:sessionId/sync` accepts `currentTime`, `duration`, and delta `timeListened`.
- `POST /api/session/:sessionId/close` performs a final sync and removes the live session.

The core treats the server's timeline as book-global seconds. It maps that to a track and local time for mpv, then maps mpv's playlist position back to the global timeline before synchronization.

## Playback engine decision

| Candidate | Strengths | v0.1 concern | Decision |
|---|---|---|---|
| mpv subprocess + JSON IPC | Native decoder, HTTP/HLS, exact seek, playlists, speed with pitch correction, PipeWire output, observable properties | Must package or ensure the executable; subprocess lifecycle work | **Selected for POC** |
| libmpv in a native sidecar | Strongest embedding and event model | Cross-compilation and native ABI/package complexity before proving audio mixing | Revisit after POC |
| GStreamer | Native PipeWire and flexible pipelines; often present in desktop stacks | Plugin availability varies and a robust multi-track controller is more code | Fallback candidate |
| ffplay | Simple and used by an existing plugin | No supported machine-readable control API; process-signal pause and estimated time are weak for audiobooks | Rejected |
| Audio in React/CEF | Minimal backend | Playback lifetime is coupled to Steam's web UI and panel lifecycle | Rejected |

The [mpv manual](https://mpv.io/manual/stable/) explicitly recommends JSON IPC rather than parsing terminal output, documents its PipeWire output, and provides native `speed`, `time-pos`, playlist, and seeking properties. It also performs pitch correction when speed differs from 1×.

### Python versus a bundled backend executable

A bundled executable is preferable **eventually**, but not because Python would decode audio: `mpv` is already the native playback engine. The current Python layer only handles HTTP, tokens, RPC, IPC commands, and a 15-second sync timer. Keeping that layer in Python makes the first hardware experiment small and debuggable.

Move orchestration to a Rust sidecar when one or more of these become real constraints:

- Decky Python lifecycle/reload behavior interrupts a desired persistent session.
- A single native package is needed for mpv/libmpv and MPRIS.
- Suspend/resume, crash recovery, and IPC ownership need system-service-level guarantees.
- CPU or memory measurement shows meaningful Python overhead (not expected at one poll per second).

The separable `abs_player_core` boundary is intended to make that replacement local rather than a UI rewrite.

## MPRIS

MPRIS is valuable for desktop interoperability and external play/pause/seek controls. It is not required for the first sound-producing milestone. The planned native service should own `org.mpris.MediaPlayer2.audiobookshelf`, expose the Player interface, and translate `Position`, `Seeked`, `Rate`, and metadata to the same core timeline. Adding MPRIS to the React layer would recreate the lifecycle problem this architecture avoids.

## PipeWire mixing status

mpv is configured for the default non-exclusive PipeWire sink, with PulseAudio and ALSA fallbacks. That is the correct shape for mixing with game audio. Valve's public SteamOS reports show PipeWire sinks in Gaming Mode, but they do not substitute for this project's acceptance test. Simultaneous audiobook/game output remains explicitly **unverified until run on a Steam Deck**.

The hardware POC must record SteamOS/Decky/mpv versions, current audio output, and the result with at least one native game and one Proton game.
