# Far-page selection retains obsolete manga tile leases

- Symptom: after selecting a distant page, the old page's decoded tile remains owned while the new page loads. If the new viewport does not report a tile window (for example, its page load fails), that lease remains until close or a later viewport callback.
- Trigger: open a chapter, admit a tile for page 0, then select page 4. The logical page window moves to pages 3–5, but `setVisible` only retires entries in `pages`; `tiles` and `wantedTiles` still contain page 0.
- Source: isolated HarmonyOS Host commit `d907289c`; no new HAP is involved. `MangaSessionController.setVisible` chooses the three-page window and awaits `loadPage`; `setTileWindow` is the only normal tile retirement path.
- Evidence and conclusion: code call-chain audit identifies an obsolete Host image lease beyond the selected logical window. This is a resource ownership defect; it does not establish a measured memory excess or a device rendering failure.
- Red/green: `tools/test-manga-far-page-tile-retirement.mjs` ran against the original method and failed because tile 0/3 remained after selecting page 4. After the correction it passed, including exactly one release and no second release on close. Existing `test-manga-session.mjs`, `test-manga-tile-window.mjs`, and `test-manga-motion-progress.mjs` passed with 20-second process-group deadlines each.
- Correction: `setVisible` now retires `tiles`, `tileLoads`, and `wantedTiles` outside its newly admitted three-page window before awaiting the current page. Neighbor tiles remain owned for continuous scroll. A stale in-flight tile cannot republish because its tile object and wanted key are both revoked.
- Verification boundary: `scripts/check-local.sh` was stopped by a 110-second hard timeout after passing checks in its completed prefix. It did not finish and is not recorded as a full-suite pass. No HAP, VM, physical-device or total-module memory verification was run for this commit.

The existing Host runtime, image gateway and ImageKit ownership are retained. No new parser, cache, or decoder is required.
