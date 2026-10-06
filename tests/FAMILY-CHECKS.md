# Family 1.0 checks — 2026-10-06

## Executed in the workspace
- Five responsive UI suites: 344×727, 390×844, 820×390, 768×1024, 1280×800.
- Existing-style joining screen goes directly to a full-viewport transparent-native-layer player; no DM/chat/call/lobby DOM or code paths.
- Empty queue, add/remove/select items, previous/next, seeking, pause, manual quality, six actual native aspect indices, audio-track dispatch, safe escaped media titles, theme selection and return to joining screen passed. MQTT and native bridge mocked in this suite. Playwright's mock suite bypasses CSP for its internal polling only; production CSP was not relaxed.
- Visibility/background event disconnects transport and clears its timers; becoming visible does not rejoin. Native Android teardown is additionally gated in source and merged-manifest checks; not tested on a handset here.
- 21 original slowest-member sync policy / simulated-transport suites passed unchanged.
- Family protocol validation passed: bounded queues/ids, deterministic revision ordering, URL restrictions, finite positions, media references and input types.

## Real public broker/browser tests (native playback mocked)
- EMQX, HiveMQ **and** tyckr each passed actual TLS/WSS connections for three Family browser clients, shared queue delivery, two-way pause state and paused late-join loading.
- Tests used the APK's actual bundled MQTT.js and production CSP from the local-file page (no CSP bypass in this suite).
- Found and fixed MQTT.js's automatic Worker keepalive conflicting with restrictive CSP: explicitly use foreground-document/native timers, not a blob Worker.
- Found cross-client retained-state write ordering can expose an older queue snapshot first. Lower-revision repair was added; a joining peer now loads paused until fresh room anchoring/settling, preventing a stale playing snapshot from briefly starting audio.
- All synthetic retained queue payloads were deleted with acknowledged QoS1 empty retained publishes; successful-run synthetic presence entries are explicitly cleared before a graceful test disconnect. Unexpected disconnects can leave harmless offline presence tombstones, which are ignored by the app.
- These tests do **not** prove old-phone MPV decoding, physical device lifecycle behavior or public broker uptime on the user's network.

## Native build/packaging gates
CI compiles release app and resolver JVM tests, checks merged manifests have zero services/receivers and no foreground/background/notification/microphone/wake-lock permissions, swaps the exact nine Synkplay0.23.0 native libraries, checks JNI ABI compatibility and hashes, aligns for 16KiB, signs with an independent family key, verifies signature and package/version, and exports source/checksums.

Initial CI 37439744430 passed compile/merged-manifest/native hash/signing gates; subsequent UI/transport fixes require the final CI run to pass again. The final run/link and APK hash are recorded in the delivered verification report after completion.

## Device acceptance still required
Install the final APK on the user's older arm64 device. Test actual MP4, YouTube144p/manual quality, MP3/artwork, two-phone family synchronization, Home, lock, Back, Recents and reopening. No sound, notifications, network reconnect or service should continue after leaving. Reopen must require Join. The joining avatar picker alone may retain an inert paused UI; it cannot keep a room/player active.

No original app/repository files were changed by this derivative.

Final hardening additionally hides the Android keyboard on Join, acquires foreground audio focus without auto-resume on focus gain, and arms a one-shot 450ms terminal shutdown fuse so a blocked native destructor cannot leave the app running. Own-UID child cleanup and an own-PID process-group ownership check cover Python/QuickJS descendants; no other app UID/group is targeted. This is terminal cleanup, not an ongoing/restart service.

Android does not expose getpgid in its public SDK. The final build reads its own /proc/self/stat with a pure, fail-closed parser (four JVM regression tests) before any process-group termination. No hidden API reflection is used.
