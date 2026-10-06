# Family Watch Party

Separate **app.party.family** / **Family Watch Party**, Android 8+ / arm64-v8a.
Derived from the user's original FINAL Android source `fdca1120141a7dfdc005796b16a0d408c1634bea`.
This repository does not update the original application, package or repository.

## Foreground only — intentionally strict
- Current joining page → immersive MPV player, playlist/source/settings inside the player.
- No chat, DM, calls, lobby, foreground/background services, notifications, PiP, boot receiver, jobs or restart watchdog.
- Home, lock or leaving the app stops playback and destroys the player and WebView/MQTT document. Resolver work and yt-dlp processes are cancelled. The inactive task remains in Recents. Returning restores a paused, local movie/queue/position snapshot; only an explicit Play reconnects and resumes. Recents swipe removes the task, with terminal cleanup when Android delivers finishing callbacks. No claim of privileged Android Force Stop; Android may retain an inert cached process. Snapshots are task-ID scoped so a new task does not restore a swiped session.
- The avatar picker may retain an **inert, paused joining screen only** while Android's external picker is open. It is unavailable while joined; there is no active media, broker connection or service behind it.
- Keep-screen-on applies only while joined and visible; it is not a background wake lock.
- Source/build tests are not a substitute for Home/lock/Recents/old-device testing on a handset.

## Fullscreen device controls (v1.2)
Swipe vertically on the left video surface for window-only brightness, or on the right for media volume. Up increases/down decreases. A small HUD reports the native level. Brightness restores on leaving the player. Media volume uses the device’s actual steps; existing player Mute remains separate/respected. Toolbar/playlist/seek-bar touches are excluded. No global brightness-write permission or room broadcast is used. The normal MODIFY_AUDIO_SETTINGS permission is for foreground media-volume adjustment only.

## Exact old player
The nine MPV/FFmpeg/C++ libraries are byte-identical to **Synkplay Android v0.23.0** (not latest). The existing `libmpvKt 0.3.0` JNI adapter is rebuilt from its pinned source for the FFmpeg62 ABI. See `tests/mpv023/manifest.json` and its README for hashes, source revisions and GPL/license notices. Wrapper changes are limited to this derivative's lifecycle fences, synchronous destruction and paused loads. Resolver pin remains yt-dlp 2026.08.19 / youtubedl-android 0.18.1.

MPV handles YouTube, direct MP4/audio streams and supported URLs. There is no YouTube iframe/browser fallback. Default YouTube144p; manual240/360/480/720/1080, exact-height selection, no Auto. Six original aspect choices, native audio tracks and MP3 embedded artwork retained. A video's permissions, codec, availability or resolver failure may still prevent playback.

## Family rooms
Family members use this APK, the same room name and same selected tower. EMQX, HiveMQ and tyckr remain available; selected-tower reconnect only. No automatic tower switch. The Family namespace is intentionally isolated from the original chat/DM app.

Shared queue and explicit controls use validated MQTT state. Original slowest-member synchronization policy and monotonic-RTT transport are retained: >8s rewind, gradual slowing, no elected host/crown. Queue metadata remains on the selected **public, anonymous broker**. Room names are hashed for topic construction, **not encrypted/private access control**. Do not paste secret/signed private media links into public rooms. Broker uptime is not guaranteed.

## Repository deletion
Joining UI, theme code, MQTT.js and player assets are bundled in the APK. No own-repo GitHub Pages URL, CDN runtime script, update checker or account backend is required. An installed APK remains independent of this repository; online media and public brokers still need internet.

**Before deleting the repo:** download the final signed APK, `Family-Watch-Party-Source.zip`, checksums and your separately supplied private signing backup. Deletion removes release-download links and this build pipeline, not the installed app. Preserve corresponding native sources/notices as required when redistributing GPL components. Signing backups must not be uploaded publicly.

## Reproduce
Java17, Gradle8.11.1, Android SDK35, NDK29.0.14206865, build-tools35.0.0.

1. `python tests/family_scope.py`; `node tests/family-protocol.cjs`; `node tests/sync-policy.cjs`.
2. `python tests/mpv023/engine_swap.py prepare --work /tmp/mpv023`.
3. `python tests/mpv023/engine_swap.py build --work /tmp/mpv023 --ndk "$ANDROID_HOME/ndk/29.0.14206865"`.
4. `./gradlew :app:testDebugUnitTest :app:assembleRelease`; `python tests/family_scope.py --merged`.
5. Follow `.github/workflows/build-apk.yml` to swap, align, sign with the separate **family** key and verify native hashes.

**Never install/distribute the raw Gradle APK: it has not received the required old native engine yet.** CI uses encrypted repository secrets `FAMILY_KEYSTORE` and `FAMILY_STORE_PASSWORD`; they are not committed. MQTT.js5.10.4 is bundled with its MIT license. Source provenance/license notices are retained, including `COPYING.GPLv3`.
