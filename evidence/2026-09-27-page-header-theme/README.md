# Shared page title live-theme repair

Observed in Host 3ade4dc2: switching General Settings from light to dark updated other preference text, while the shared title remained black. Original VM evidence: `reader-control-real-3ade-ui-dark-reduced-settings.png`; root recorded the failure in real-books/vm-observations.jsonl. This patch did not operate the VM.

Cause: `PageBackBar.titleColor` was an ordinary field initialized once using the initial App scheme. The retained build observer read the captured color rather than the current theme. All default PageBackBar titles shared this path. SyncPage is the sole explicit titleColor override, so its parent-supplied value also needs a reactive Prop. AppTopBar already resolves its title color inside build and needs no change.

Fix: the optional override is a string Prop with an empty sentinel; the Text observer resolves the existing TOK_INK color against the current App scheme when no override is present. No palette, typography, layout, default Day color or theme setting changed.

Proof: `tools/test-theme-page-back-bar.mjs` runs the real SDK-transformed production build observer and evaluates the actual production initializer. Red log shows stale Day `#FF1F1B17` versus expected Night `#FFEADFCE`. Green covers retained Day→Night→Day, Sync override values, removing the override and an AST declaration guard requiring Prop. Existing primary-text and local-consumer theme gates pass. The old primary-text gate scanned direct primary token foregrounds; local-consumer coverage was limited to its migration inventory, so neither exercised this shared header initializer. The new test is picked up by the existing test-*.mjs gate.

SDK observer replay verifies code binding, not native dependency scheduling or device pixels. Final full ArkTS/package and VM visual verification remain separate gates.
