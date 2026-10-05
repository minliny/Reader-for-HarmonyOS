# R5 VM session: fixed directory entry and exit samples

Canonical run `20261003T123734Z-568ec4e3-52338352`, signed HAP SHA256 `f00ebc4a15240832ee5decf39f660cf30eafcf7454759c85875dd94af4f74719`; full 436 contracts, non-incremental ArkTS build, signing, verify and same-identity inspect passed. Deployment receipt completed at `2026-10-03T12:38:52.097Z`, install/launch PASS, dataPolicy preserve. Signing is the authorized minliny_HarmonyOS identity. This is an isolated iteration candidate, not a mainline or user-accepted release.

Before install and before the UI session the shared lease directory had no live target/server lock. The bounded helper acquired VM `127.0.0.1:5555` and server `127.0.0.1:8710` once; all HDC calls were serialized through it. No physical device was used.

## Exact minimal UI sequence

1. Fetch `vm/shelf.json`; click the observed continue-reading action at 1075,654. Fetch `vm/reader.json`: same real manga, page 5 / 32. Reveal controls at 640,1400; fetch `vm/controls.json`, with title chapter 05 and the three controls.
2. Open directory at observed control text coordinates 285,2602. Fetch `directory-initial.json`, confirm actual 04/05-current/06 content, then fetch the original 1280x2832 `directory-initial.jpeg`. This ordinary initial opening prepares the existing lazy checked font owner before motion sampling; its latency was not measured. It is not a motion-sampling retry.
3. Send the frozen collector. Close at the observed clickable Row 1175,930, then fetch `closed-before-sample.json`, confirming no directory and same page 5 / 32.
4. Execute exactly one 9-frame `dir-open` plan, run 202610032100, native output folder `/data/local/tmp/manga-windowed-progressive-202610032100-dir-open`. Collector result failed=0; fetch all 32 original output files. Capture settled original `vm/directory.jpeg` and UI tree `vm/directory.json` without overwriting the initial capture.
5. Execute exactly one 9-frame `dir-close` plan, run 202610032101, native folder `/data/local/tmp/manga-windowed-progressive-202610032101-dir-close`. Collector result failed=0; fetch all 32 original output files. Fetch `after-close.json`, confirming directory removed and page 5 / 32 preserved.
6. Reopen directory at 285,2602 only to restore the current review scene. Fetch `final-directory.json` and full original `final-directory.jpeg`: same chapter 05, current highlight and page 5 / 32. Explicitly exit helper; process exit0, lease-released reported. Fresh lease inventory contains only events.jsonl, no locks.

No chapter was selected and no mode, fit, brightness, theme or page-number preference was changed in this R5 session. No source was imported, and no application data was cleared. The install receipt proves the preserve-data route; UI trees additionally show the same visible ordinal, not exact within-page scalar or cold restart acceptance.

## Evidence boundaries

Motion JPEGs are native 640x1416 outputs, not generated or interpolated frames. Full settled screenshots are native 1280x2832. The fixed plan contains baseline, three staggered requests, post-command and three sequential requests, then one late sample. Maximum three native snapshot workers run within a single HDC shell. All native timestamps have nine fractional digits and exit0. Request/completion windows can overlap and are not VSync paint timestamps; file order does not establish a continuous trajectory. No samples were retried for desired pixels.

Root observed actual chapters in open frame4 while the panel remains below its settled position, and actual rows retained during close frame3. Independent directory review supplies its separate original-frame/hash/anchor assessment. Precise curve, exact duration, continuous smoothness, physical device and user acceptance are not established by this sample plan. Wide/landscape directory and hierarchical volume painting were not exercised by this phone/flat-source session.

The other two panels and their R4 original evidence are retained separately. R5 changes only NavigationSurface and its SDK gate; it does not turn R4 native evidence into a new R5 capture of those panels. Reconstructable source and canonical artifact binding are under `source-delta/`; exact CLI logs/receipt and collector scripts are preserved under `canonical-delivery/` and `collection/`.
