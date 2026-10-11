# Third-party notices

Tagged release packages may contain an audio-only `mpv` executable in `bin/mpv`.
It is built without local source modifications by `scripts/build_mpv.sh` from
the exact revisions below:

- [mpv](https://github.com/mpv-player/mpv/tree/e48ac7ce08462f5e33af6ef9deeac6fa87eef01e), GPL-2.0-or-later/LGPL-2.1-or-later
- [FFmpeg](https://github.com/FFmpeg/FFmpeg/tree/db69d06eeeab4f46da15030a80d539efb4503ca8), LGPL-2.1-or-later with GPL components enabled
- [libass](https://github.com/libass/libass/tree/e46aedea0a0d17da4c4ef49d84b94a7994664ab5), ISC
- [libplacebo](https://github.com/haasn/libplacebo/tree/1fd3c7bde7b943fe8985c893310b5269a09b46c5), LGPL-2.1-or-later
- [mpv-build](https://github.com/mpv-player/mpv-build/tree/9443097290e82008f26f1597590926c63e7ae053), GPL-2.0-or-later

The corresponding source is available at the linked revisions, and the full
reproducible build configuration is included in this repository. The bundled
player is a separate executable communicating with the BSD-licensed plugin over
mpv's JSON IPC protocol.
