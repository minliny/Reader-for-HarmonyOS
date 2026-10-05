# Manga UI implementation

User approval on 2026-10-02: preserve and record the approved http://127.0.0.1:4197/ design; create independent worktrees; implement the changes.

Design baseline: paired Reader-UI/design/manga-ui-20261002/ with input hashes, page plan, 22 screenshots, QA and reproducible code.

All three repositories use branch codex/manga-ui-20261002 from the paired manga engine commits. The original demo, main workspace and old candidate are preserved. Existing Core, image Host, PhotoView, directory proofs and progress CAS are retained; generic component/error architecture is not duplicated.

Scope: narrow dynamic floating main navigation; manga shelf filters and image position; centered detail and grouped catalog; immersive/controls/catalog/mode/settings/more/chapter-end; wide layouts and reading background; incremental full-screen source picker with actual search timing, stop/retest, and direct candidate navigation. Demo fixtures and invented percentages/image latency are excluded.

Evidence tiers: source/local tests, SDK emitted builders, full HAP, VM/device pixels, user acceptance are separate. Deployment and mainline merge are outside this request.

Worktree initialization found a missing Git LFS executable. Per-command filter override completed checkout; every tracked input was scanned and no LFS pointer remained. No global configuration changed.

Signing policy: minliny_HarmonyOS and io.reader.minliny. Current canonical build/signature checks are inherited; no certificate is generated or rotated.
