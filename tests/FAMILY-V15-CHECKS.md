# Family v1.5 / code6 — tower-independent local mode

## Acceptance behavior
- If the selected tower cannot complete the room subscription for 10 seconds, the app enters Independent mode. If an established MQTT connection closes or goes offline, it switches immediately and closes that MQTT client rather than silently retrying.
- The current native MPV decoder, stream/cache, extractor and screen remain local. Existing movie playback and local playlist/controls do not depend on the tower. Adding/selecting/removing items, pause, seek and next/previous operate on this device; no state or sync packets are published while independent.
- The last valid queue/current position is cached in app WebView storage by room name. A failed initial tower join can restore that local list without MQTT state. A restored independent task remains inert until explicit Play; its next Play loads the saved source locally without joining the room.
- The top Independent status and playlist's “Room se reconnect” control retry only the selected tower on explicit user action. A same-item reconnect reuses an already-loaded decoder; a live peer's changed room state may be reconciled after the user requests reconnect. A failed retry returns to local mode.
- Lock/Home behavior remains v1.4: lock holds playback while keeping the loaded player alive; explicit Play uses the same decoder. Recents/Close remains terminal task cleanup.

## Automated checks
- `python tests/family_scope.py`: static package, UI, lifecycle and local-mode source gates.
- `node tests/family-session.cjs`: mocked retained-lock, actual process-loss, independent-mode restore/Play and reconnect reconciliation.
- `node tests/family-protocol.cjs`, `node tests/family-timers.cjs`, `node tests/sync-policy.cjs`, `node tests/family-gestures.cjs`, `node tests/family-seek-drag.cjs`.
- `PLAYWRIGHT_MODULE=... node tests/family-ui.cjs`: five responsive Chromium viewports, simulated broker loss, no MQTT publications in local mode, queue editing/persistence and same-item reconnect without another native load. Browser MQTT/native bridge are mocked for this scenario.
- Android unit and merged-manifest gates remain in CI; the same signed package and pinned MPV023 engine are required for release.

## Limitations / device gates
- Independent mode only removes the broker dependency. YouTube/direct online media still require internet, an available media source and a functioning decoder. It does not provide offline media downloads; existing forward cache remains capped at 100 MiB.
- Local queue metadata/URLs are persisted on the device; public MQTT-room privacy remains unchanged. Offline peers do not sync. Manual reconnect may reconcile a live peer's newer state and can load a different selected movie.
- Chromium mocks/static checks are not a physical phone test. Test tower outage during active playback, Add/playlist/seek/next, lock/unlock, app process loss, reconnect with the same and a changed peer state, and Recents swipe on the handset. Android/OEM/Doze, media-source loss and renderer failures can still interrupt playback.
