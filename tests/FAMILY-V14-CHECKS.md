# Family v1.4 / code5 — retain live buffer on lock

Supersedes v1.3's destructive background suspension for joined sessions. Lock/Home now pauses the actual decoder but retains the same MPV instance, demuxer cache, pending resolver, WebView, MQTT client and room identity. Unlock itself neither joins nor loads nor resumes. Explicit native-authorized Play resumes the retained movie; a real room track/seek change or explicit retry may legitimately load/seek.

## Runtime changes
- One non-exported mediaPlayback foreground service, started only by foreground user joining. Ongoing notification with Close action, partial wake lock, START_NOT_STICKY, no boot/alarm/restart path.
- Service onTaskRemoved routes to terminal Activity cleanup, removes task snapshot, releases wake/notification, closes decoder/document/extractor and kills only this app's process scope. Explicit leave stops the service. This is callback-dependent cleanup, not privileged Android Force Stop.
- Main-looper timers are installed before MQTT.js, replacing hidden-WebView setTimeout/setInterval throttling. Scoped to the current document and cancelled on teardown. The retained renderer has important priority.
- Native playback hold gates queued resume/seek and startPaused loads. User Play checks foreground/interactive/unlocked state and acknowledges a request ID; stale acknowledgements after another lock cannot resume.
- Hidden/held clients remain present but provide no sync anchor and publish no stale playhead snapshot. Incoming room changes are deferred until explicit Play. Decoder-ready progress is still accepted while held.
- Existing 100MiB forward-cache budget retained (split when audio/video use separate demuxers). Buffering stops at that budget or media EOF, not a guarantee of whole-film downloading.
- After actual OS process loss, v1.3's task-scoped paused snapshot is still a recovery fallback, not a RAM-cache preservation claim. OEM battery/Doze, memory, renderer and network interruptions remain possible.
- Same exact Synkplay0.23.0 engine, signer/package, quality policy, accepted cutout/seek controls and brightness/volume gestures. Original Music app unchanged.

## Local tests executed
- 21 sync-policy tests, protocol bounds, seek-drag and gesture callbacks passed.
- Production session fixtures passed: offline process-death recovery, live room reconciliation, same decoder/load key/room across lock, native progress while held, no unlock autoplay, no solo Play reload/seek, deferred remote track changes, foreground-load/lock race, stale native Play grants and explicit leave.
- Native-timer adapter tests passed: once/repeat, arguments, cancellation, stale callbacks, nesting, bounds and browser fallback.
- Five Chromium viewport suites passed using the production native-timer adapter with a mocked main-looper bridge: 344x727, 390x844, 820x390, 768x1024, 1280x800. Native playback and MQTT mocked, not real decoder/broker tests.
- Static gates verify retained background path has no destroy/cancel/loadGeneration/kill/finish, native play/seek gates, exactly one media FGS, no receivers/boot/restart, wake release and task-removal cleanup.

## Release/device gates
Android host compilation, complete JVM suite, merged manifest, exact-engine/JNI substitution, signature and alignment are required in CI before release. Independent release checks are recorded outside the source tree after publication.

Handset acceptance still required: play and lock mid-buffer; wait several minutes; unlock without Play (must stay paused); Play solo (no reload); remote play/seek/track change while locked; lock during extraction; repeated lock/unlock; swipe Recents and verify notification/loading stop; reopen new task without automatic join. Android/OEM restrictions cannot be eliminated by these source/mock tests.
