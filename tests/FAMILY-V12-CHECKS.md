# Family1.2 / code3 — gesture scope and verification

User confirmed left-side vertical swipe for brightness and right-side swipe for volume, like original fullscreen player, with a small level indicator. User independently confirmed v1.1 fixed the left black strip and seek problem.

- Separate surface-only pointer handler: left/right half locked at start, upward increases/downward decreases, 12px vertical intent threshold, horizontal gestures ignored.
- Pointer capture keeps a swipe on the video surface; toolbar/playlist/seek/button gestures are excluded. Synthetic post-swipe clicks do not toggle controls. Taps retain existing behavior.
- Foreground-gated native commands capture real initial levels and apply bounded deltas. Native feedback drives the HUD (not a pretend JavaScript percentage).
- Brightness changes Activity window only (.05–1.0) and restores previous window brightness on leaving. No WRITE_SETTINGS, Settings.System.put*, global brightness-mode change or permission popup.
- Volume changes STREAM_MUSIC in the device's actual steps, clamps to maximum and skips duplicate writes. Normal MODIFY_AUDIO_SETTINGS permission added; no background permission/service. Existing player Mute remains respected and is labelled in volume HUD.
- Native fixed-volume/security restrictions yield an unavailable indicator rather than a false new level.
- Cancel, drawer, resize, leave/pagehide/visibility cleanup; late acknowledgement ids ignored. No MQTT gesture messages.
- No changes to MPV engine, sync/room protocol, v1.1 seek/cutout fixes or hard background shutdown.

Executed locally: portrait/landscape gesture DOM/native mocks, seek regression, 21 original sync simulations, source guards, JavaScript syntax and diff whitespace checks.
Added two GestureMath JVM tests for future CI; they have NOT been compiled/executed in this workspace.

Fresh publishing authorization supplied. Delivery is gated on CI build/Android compile, expanded browser gesture integration checks and signing/native/binary validation. The completed build/hash will be recorded in the delivered verification report. Physical-phone brightness/media-volume acceptance remains required.
No change to previous workspace cleanup: only the new deliverable will be downloaded for verification, and generated browser/build caches will be removed afterwards.
