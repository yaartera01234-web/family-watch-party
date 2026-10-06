# Family v1.3 / code4 — paused task lifecycle

## Scope
Replaces terminal lock/Home behavior with reversible suspension. The task stays in Recents. Native media, WebView/MQTT document, extractor work and timers are torn down; brightness/focus/keep-screen-on are released. Returning reconstructs an offline paused UI from a bounded task-ID-scoped local snapshot. No broker connection or media load is issued until explicit Play/Retry. Finishing paths retain terminal cleanup; no service, receiver or automatic restart was added.

Recents swipe removes the task. Android/OEM callback delivery controls whether terminal process cleanup runs; an inert cached process is not a privileged Android Force Stop. A new task ignores the previous task's snapshot.

Manual reconnect waits for subscribed room state before choosing the live room selection/anchor. A solo returning viewer uses the saved local decoder position, not an older retained heartbeat. Live cleared playlists are respected. Old page bridge calls, resolver completions and reconnect timers are fenced after suspension.

Same package/key workflow, exact MPV donor configuration, accepted cutout/seek behavior and brightness/volume controls retained. Original Music app untouched. APK delivery remains GitHub-only.

## Executed locally
- `python tests/family_scope.py`: pass, including reversible-suspend/no-terminal-kill and offline-restore static gates.
- `node tests/sync-policy.cjs`: 21 simulated synchronization tests pass.
- Protocol, seek-drag and gesture callback suites: pass.
- `node tests/family-session.cjs`: paused restoration; no automatic network/media start; saved solo position; live movie and cleared-queue reconciliation; anchor hold; paused-room explicit resume; cancellation; stale callbacks; repeated return and explicit leave pass. DOM/transport/native mocked.
- Playwright Chromium 134: five viewport suites (344×727, 390×844, 820×390, 768×1024, 1280×800) pass, including keeping the paused movie at 10:11 on visibility loss, no reconnect on visibility return, and explicit Play restoring position. MQTT/native bridge mocked.
- Kotlin 2.0.21 direct JVM compilation and JUnit execution: SessionSnapshotTest, ShutdownScopeTest, YtStreamSelectionTest — 21 tests pass. This is not Android host compilation. Existing GestureMath Android-dependent suite remains in CI.
- Remote main checked publicly: still `dfbce5629c76466386e3a22a9e73f07335a689ba` (v1.2 baseline) before any push.
- No workspace APK exists.

## Still required before delivery
- Full Android/Gradle compilation, complete JVM suite and merged-manifest gates in GitHub Actions.
- Same-key signature, alignment, version and exact donor-library verification of published APK.
- Real handset checks: Home, lock/unlock, swipe task, repeat resume, Android process eviction, rapid background during extraction/seek; no autoplay and active-room reconciliation.

No claim of a published v1.3 or handset verification is made by this local report.
