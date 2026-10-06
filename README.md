# Family Watch Party

Separate **app.party.family** / **Family Watch Party**, Android 8+ / arm64-v8a.
Derived from the user's original FINAL Android source `fdca1120141a7dfdc005796b16a0d408c1634bea`.
This repository does not update the original application, package or repository.

## Local independent playback + retained movie session (v1.5)
- Joining page → immersive MPV, playlist/source/settings inside. No chat, DM, calls or lobby.
- Lock/Home pauses playback but retains the **same native player/cache, ongoing extractor and WebView**; the MQTT room is retained while connected. Unlock does not reload, rejoin or autoplay. Explicit Play resumes the retained decoder. Live peer changes are reconciled only after that action; a legitimate room track change/seek may require loading another movie/position.
- If the chosen tower cannot connect within 10 seconds, or an established tower connection drops, Family enters **Independent mode**: the current decoder keeps playing, and local add/play/pause/seek/playlist controls keep working without room sync. Queue/state is cached in WebView storage on this device, keyed by room.
- Independent mode does not sync with other phones and never auto-switches towers. Tap **Independent · Reconnect** (or **Room se reconnect** in the playlist) to try the same selected tower manually. A same-item reconnect keeps the loaded decoder; if a live peer has a changed room state, the explicit reconnect can reconcile it.
- Online links still require internet and a working media source. Local queue metadata is stored on-device; public room URLs remain visible to other room subscribers, so do not use secret/signed private links.
- A user-started, **START_NOT_STICKY mediaPlayback foreground service**, ongoing notification and partial CPU wake lock support background buffering/room maintenance. There is no boot receiver, sticky restart, alarm or restart worker. Grant notifications to see the session notification and its Close action.
- While room-connected, main-looper-backed timers drive MQTT rather than relying on throttled hidden-WebView timers. A paused device is excluded from sync anchors and does not rewind active peers. Native gates prevent queued/remote Play or Seek from reviving playback while held.
- MPV's existing **100 MiB** forward-cache budget (split across separate video/audio demuxers) is unchanged. Loading continues until the budget or end of media; this is not an unlimited download or whole-process RAM limit.
- Recents swipe invokes the service's task-removal cleanup and stops media, sockets, timers, extractor, notification and wake lock. Close session/explicit exit also clean up. Android/OEM delivery and process eviction remain outside app control; this is not privileged system Force Stop. No automatic restart.
- Android/OEM battery/Doze restrictions, memory pressure, renderer failure, or media-network/source loss can still interrupt playback. Broker loss by itself now switches to local mode, but cannot restore room sync. After actual process loss, the task-scoped local snapshot is an offline paused recovery, not a preserved RAM cache. New tasks ignore a swiped task's snapshot.
- Window brightness and audio focus are released on backgrounding; playback stays paused on return. The avatar picker is joining-screen-only. Keep-screen-on applies only to the visible player, not lock-screen buffering.
- Automated checks do not replace handset testing of long screen locks, cache continuity, pending extraction, unlock, remote commands and Recents swipe.

## Fullscreen device controls (v1.2)
Swipe vertically on the left video surface for window-only brightness, or on the right for media volume. Up increases/down decreases. A small HUD reports the native level. Brightness restores on leaving the player. Media volume uses the device’s actual steps; existing player Mute remains separate/respected. Toolbar/playlist/seek-bar touches are excluded. No global brightness-write permission or room broadcast is used. The normal MODIFY_AUDIO_SETTINGS permission is for foreground media-volume adjustment only.

## Exact old player
The nine MPV/FFmpeg/C++ libraries are byte-identical to **Synkplay Android v0.23.0** (not latest). The existing `libmpvKt 0.3.0` JNI adapter is rebuilt from its pinned source for the FFmpeg62 ABI. See `tests/mpv023/manifest.json` and its README for hashes, source revisions and GPL/license notices. Wrapper changes are limited to this derivative's lifecycle fences, synchronous destruction and paused loads. Resolver pin remains yt-dlp 2026.08.19 / youtubedl-android 0.18.1.

MPV handles YouTube, direct MP4/audio streams and supported URLs. There is no YouTube iframe/browser fallback. Default YouTube144p; manual240/360/480/720/1080, exact-height selection, no Auto. Six original aspect choices, native audio tracks and MP3 embedded artwork retained. A video's permissions, codec, availability or resolver failure may still prevent playback.

## Family rooms
For shared playback, family members use this APK, the same room name and same selected tower. EMQX, HiveMQ and tyckr remain available; selected-tower reconnect only. No automatic tower switch. If a tower is down, Independent mode is local to each device until someone manually reconnects; it does not preserve cross-device sync during the outage. The Family namespace is intentionally isolated from the original chat/DM app.

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
