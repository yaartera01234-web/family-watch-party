# Family1.1 / code2 — fix scope and verification

User reported landscape left black strip and seeking about ten minutes forward returning to the previous position. User explicitly confirmed being alone in the room.

- Compared original pinned MpvFullscreenControls: it permits display-cutout layout and disables decor fitting in fullscreen. Family host lacked those flags.
- Added equivalent API28/30-guarded cutout/full-width layout only while joined; restore default fitting on return to joining screen. No video zoom/aspect/cropping workaround.
- Family UI was assigning slider value from native progress every300ms even during dragging. New drag/draft guard freezes slider bounds/value and preview time while tracking, commits the selected target once on change, handles pointer cancellation/blur and clears drag on media load/leave. Controls cannot auto-hide mid-drag.
- Node VM fixture executes real family.js handlers with a fake DOM/native bridge: ten-minute target survives ten stale samples, one final seek, reverse seek, keyboard input, cancel/blur/leave pass. A negative control reproduces the old progress overwrite.
- All21 original synchronization-policy tests and source scope guards pass. Native decoder/wrapper, synchronization modules, resolver and background teardown unchanged.
- Version1.1-MPV023/code2, same package and family key. CI points to new v1.1 tag and includes seek regression test.

Publishing authorized with freshly supplied access. CI must pass compile/sign/exact-engine verification before delivery. Browser regression also exercises actual mouse dragging under repeated native-progress samples at five viewport sizes. Physical-phone notch/fullscreen and actual decoder seeking remain device acceptance checks; mock/browser tests are not handset proof. The final delivered verification report records the completed run and APK hash.
