# First hardware proof-of-concept checklist

Record device details before starting:

- Steam Deck model:
- SteamOS version/channel:
- Decky Loader version/channel:
- Audiobookshelf server version:
- mpv version and source:
- Audio output (speakers/headset/HDMI/Bluetooth):
- Native or Proton test game:

## Installation and authentication

- [ ] `dist/index.js` loads without a Decky/CEF error.
- [ ] Plugin runs as the Deck user, not root.
- [ ] The setup form is fully reachable with D-pad/sticks and A/B.
- [ ] Login succeeds against a current server.
- [ ] Restarting Decky restores the session without asking for the password.
- [ ] Forced access-token expiry triggers refresh and rotated tokens continue working.

## Audiobookshelf data

- [ ] Book libraries load.
- [ ] Continue Listening matches the official client.
- [ ] Library browsing opens a book.
- [ ] Search finds a known title and author.
- [ ] Cover, title, author, current chapter, duration, and resume position are correct.

## Audio milestone

- [ ] Start a game and confirm its audio is playing.
- [ ] Open **… → Decky → Audiobookshelf** without leaving the game.
- [ ] Resume a multi-file audiobook.
- [ ] Hear both the game and audiobook through the selected output.
- [ ] Close the Quick Access menu; audiobook continues.
- [ ] Reopen the panel; position and play state are current.
- [ ] Play/pause works.
- [ ] Seek −15/+15 seconds works across a file boundary.
- [ ] Previous/next chapter works.
- [ ] 0.75×, 1×, 1.25×, 1.5×, and 2× retain intelligible pitch.
- [ ] Switching the Steam audio output moves both streams appropriately.

## Progress and resilience

- [ ] Audiobookshelf shows an open session for this device while playing.
- [ ] Progress advances on the server within 15–30 seconds.
- [ ] Paused time is not counted as listened time.
- [ ] Seeking is reflected in the official client.
- [ ] Stopping/unloading closes the session with a final progress update.
- [ ] Resume from another official client starts within a few seconds of the Deck position.
- [ ] Suspend/resume behavior is recorded (recovery is not implemented yet).
- [ ] Killing mpv surfaces a useful error instead of silently advancing.

## Focus quality

- [ ] No essential action requires touch, mouse, or trackpad cursor mode.
- [ ] Focus order is predictable in player controls, browse navigation, results, and settings.
- [ ] Focus remains visible at the top and bottom of scrollable lists.
- [ ] B/back never strands the user outside the plugin flow.
